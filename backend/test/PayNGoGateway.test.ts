import { expect } from "chai";
import { ethers } from "hardhat";
import { PayNGoGateway, MockERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PayNGoGateway", () => {
    let gateway: PayNGoGateway;
    let mockUSDC: MockERC20;
    let owner: HardhatEthersSigner;
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;

    const USDC_DECIMALS = 6;
    const HUNDRED_USDC = ethers.parseUnits("100", USDC_DECIMALS);
    const TEN_USDC = ethers.parseUnits("10", USDC_DECIMALS);
    const ONE_ETH = ethers.parseEther("1");

    beforeEach(async () => {
        [owner, alice, bob] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6) as MockERC20;
        await mockUSDC.waitForDeployment();

        const PayNGoGateway = await ethers.getContractFactory("PayNGoGateway");
        gateway = await PayNGoGateway.deploy(
            await mockUSDC.getAddress(),
            ethers.ZeroAddress
        ) as PayNGoGateway;
        await gateway.waitForDeployment();

        await gateway.connect(owner).deposit({ value: ONE_ETH });

        // Mint USDC para alice y aprueba al gateway
        await mockUSDC.mint(alice.address, HUNDRED_USDC);
        await mockUSDC.connect(alice).approve(await gateway.getAddress(), HUNDRED_USDC);
    });

    // ─── Deposit / Withdraw ───────────────────────────────────────

    describe("deposit y withdraw", () => {
        it("owner puede depositar ETH", async () => {
            const balance = await gateway.getEthBalance();
            expect(balance).to.equal(ONE_ETH);
        });

        it("owner puede retirar ETH", async () => {
            const before = await ethers.provider.getBalance(owner.address);
            await gateway.withdraw(ONE_ETH, owner.address);
            const after = await ethers.provider.getBalance(owner.address);
            expect(after).to.be.gt(before);
        });

        it("no owner no puede depositar", async () => {
            await expect(
                gateway.connect(alice).deposit({ value: ONE_ETH })
            ).to.be.revertedWithCustomError(gateway, "OwnableUnauthorizedAccount");
        });
    });

    // ─── Políticas ────────────────────────────────────────────────

    describe("políticas de sponsorship", () => {
        it("política default es Full con 300k gas max", async () => {
            const policy = await gateway.getPolicyFor(alice.address);
            expect(policy.mode).to.equal(0);
            expect(policy.maxGasPerTx).to.equal(300_000);
            expect(policy.active).to.equal(true);
        });

        it("owner puede establecer política Partial para un usuario", async () => {
            await gateway.setPolicy(alice.address, 1, 5000, 200_000);
            const policy = await gateway.getPolicyFor(alice.address);
            expect(policy.mode).to.equal(1);
            expect(policy.userShareBps).to.equal(5000);
        });

        it("owner puede establecer política Token para un usuario", async () => {
            await gateway.setPolicy(alice.address, 2, 0, 150_000);
            const policy = await gateway.getPolicyFor(alice.address);
            expect(policy.mode).to.equal(2);
        });

        it("revierte si Partial sin userShareBps", async () => {
            await expect(
                gateway.setPolicy(alice.address, 1, 0, 200_000)
            ).to.be.revertedWithCustomError(gateway, "InvalidPolicy");
        });
    });

    // ─── Whitelist / Blacklist ────────────────────────────────────

    describe("whitelist y blacklist", () => {
        it("owner puede agregar usuario a whitelist", async () => {
            await gateway.setWhitelisted(alice.address, true);
            const stats = await gateway.getUserStats(alice.address);
            expect(stats.isWhitelisted).to.equal(true);
        });

        it("blacklist bloquea sponsorship", async () => {
            await gateway.setBlacklisted(alice.address, true);
            await expect(
                gateway.sponsorTransaction(alice.address, 100_000, 1_000_000_000)
            ).to.be.revertedWithCustomError(gateway, "UserBlacklisted");
        });

        it("whitelistOnly bloquea usuarios no whitelisted", async () => {
            await gateway.setWhitelistOnly(true);
            await expect(
                gateway.sponsorTransaction(alice.address, 100_000, 1_000_000_000)
            ).to.be.revertedWithCustomError(gateway, "UserNotWhitelisted");
        });

        it("whitelistOnly permite usuarios whitelisted", async () => {
            await gateway.setWhitelistOnly(true);
            await gateway.setWhitelisted(alice.address, true);
            const tx = await gateway.sponsorTransaction(alice.address, 100_000, 1_000_000_000);
            await expect(tx).to.emit(gateway, "GasSponsored");
        });
    });

    // ─── sponsorTransaction ───────────────────────────────────────

    describe("sponsorTransaction", () => {
        it("patrocina tx con política Full correctamente", async () => {
            const tx = await gateway.sponsorTransaction(alice.address, 100_000, 1_000_000_000);
            await expect(tx).to.emit(gateway, "GasSponsored");
            const stats = await gateway.getUserStats(alice.address);
            expect(stats.ethSponsored).to.be.gt(0);
        });

        it("revierte si gas price demasiado alto", async () => {
            await expect(
                gateway.sponsorTransaction(alice.address, 100_000, ethers.parseUnits("600", "gwei"))
            ).to.be.revertedWithCustomError(gateway, "GasPriceTooHigh");
        });

        it("revierte si gas limit excede máximo de política", async () => {
            await expect(
                gateway.sponsorTransaction(alice.address, 400_000, 1_000_000_000)
            ).to.be.revertedWithCustomError(gateway, "GasLimitExceeded");
        });

        it("revierte si no hay suficiente ETH en gateway", async () => {
            await gateway.withdraw(ONE_ETH, owner.address);
            await expect(
                gateway.sponsorTransaction(alice.address, 100_000, 1_000_000_000)
            ).to.be.revertedWithCustomError(gateway, "InsufficientDeposit");
        });
    });

    // ─── executeGaslessPayment ────────────────────────────────────

    describe("executeGaslessPayment", () => {
        it("ejecuta pago gasless correctamente", async () => {
            const bobBefore = await mockUSDC.balanceOf(bob.address);

            // Alice llama directamente — ella es msg.sender y ya aprobó en beforeEach
            const tx = await gateway.connect(alice).executeGaslessPayment(
                alice.address,
                bob.address,
                TEN_USDC,
                100_000
            );

            await expect(tx).to.emit(gateway, "GasSponsored");

            const bobAfter = await mockUSDC.balanceOf(bob.address);
            expect(bobAfter - bobBefore).to.equal(TEN_USDC);
        });

        it("USDC llega completo al receptor sin deducción", async () => {
            // Alice llama directamente — ella es msg.sender y ya aprobó en beforeEach
            await gateway.connect(alice).executeGaslessPayment(
                alice.address,
                bob.address,
                TEN_USDC,
                100_000
            );

            const bobBalance = await mockUSDC.balanceOf(bob.address);
            expect(bobBalance).to.equal(TEN_USDC);
        });
    });

    // ─── estimateUsdcCost ─────────────────────────────────────────

    describe("estimateUsdcCost", () => {
        it("Full mode retorna 0 USDC para el usuario", async () => {
            const [usdcCost] = await gateway.estimateUsdcCost(alice.address, 100_000, 1_000_000_000);
            expect(usdcCost).to.equal(0);
        });

        it("Token mode retorna costo en USDC", async () => {
            await gateway.setPolicy(alice.address, 2, 0, 200_000);
            const [usdcCost] = await gateway.estimateUsdcCost(alice.address, 100_000, 1_000_000_000);
            expect(usdcCost).to.be.gt(0);
        });
    });
});
