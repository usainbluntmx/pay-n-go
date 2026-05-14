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

        // Deploy MockERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6) as MockERC20;
        await mockUSDC.waitForDeployment();

        // Deploy PayNGoGateway
        const PayNGoGateway = await ethers.getContractFactory("PayNGoGateway");
        gateway = await PayNGoGateway.deploy(
            await mockUSDC.getAddress(),
            ethers.ZeroAddress // router no necesario para estos tests
        ) as PayNGoGateway;
        await gateway.waitForDeployment();

        // Depositar ETH para gas
        await gateway.connect(owner).deposit({ value: ONE_ETH });

        // Mint USDC para alice
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
            expect(after).to.be.gt(before); // mayor por el ETH retirado menos gas
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
            expect(policy.mode).to.equal(0); // Full
            expect(policy.maxGasPerTx).to.equal(300_000);
            expect(policy.active).to.equal(true);
        });

        it("owner puede establecer política Partial para un usuario", async () => {
            await gateway.setPolicy(
                alice.address,
                1, // Partial
                5000, // usuario paga 50%
                200_000
            );

            const policy = await gateway.getPolicyFor(alice.address);
            expect(policy.mode).to.equal(1); // Partial
            expect(policy.userShareBps).to.equal(5000);
        });

        it("owner puede establecer política Token para un usuario", async () => {
            await gateway.setPolicy(
                alice.address,
                2, // Token
                0,
                150_000
            );

            const policy = await gateway.getPolicyFor(alice.address);
            expect(policy.mode).to.equal(2); // Token
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

            const tx = await gateway.sponsorTransaction(
                alice.address,
                100_000,
                1_000_000_000
            );
            await expect(tx).to.emit(gateway, "GasSponsored");
        });
    });

    // ─── sponsorTransaction ───────────────────────────────────────

    describe("sponsorTransaction", () => {
        it("patrocina tx con política Full correctamente", async () => {
            const tx = await gateway.sponsorTransaction(
                alice.address,
                100_000,
                1_000_000_000 // 1 gwei
            );

            await expect(tx).to.emit(gateway, "GasSponsored");

            const stats = await gateway.getUserStats(alice.address);
            expect(stats.ethSponsored).to.be.gt(0);
        });

        it("revierte si gas price demasiado alto", async () => {
            await expect(
                gateway.sponsorTransaction(
                    alice.address,
                    100_000,
                    ethers.parseUnits("600", "gwei") // > MAX_GAS_PRICE
                )
            ).to.be.revertedWithCustomError(gateway, "GasPriceTooHigh");
        });

        it("revierte si gas limit excede máximo de política", async () => {
            await expect(
                gateway.sponsorTransaction(
                    alice.address,
                    400_000, // > 300k default
                    1_000_000_000
                )
            ).to.be.revertedWithCustomError(gateway, "GasLimitExceeded");
        });

        it("revierte si no hay suficiente ETH en gateway", async () => {
            // Retirar todo el ETH
            await gateway.withdraw(ONE_ETH, owner.address);

            await expect(
                gateway.sponsorTransaction(
                    alice.address,
                    100_000,
                    1_000_000_000
                )
            ).to.be.revertedWithCustomError(gateway, "InsufficientDeposit");
        });
    });

    // ─── executeGaslessPayment ────────────────────────────────────

    describe("executeGaslessPayment", () => {
        it("ejecuta pago gasless correctamente", async () => {
            const bobBefore = await mockUSDC.balanceOf(bob.address);

            const tx = await gateway.executeGaslessPayment(
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
            await gateway.executeGaslessPayment(
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
            const [usdcCost] = await gateway.estimateUsdcCost(
                alice.address,
                100_000,
                1_000_000_000
            );
            expect(usdcCost).to.equal(0);
        });

        it("Token mode retorna costo en USDC", async () => {
            await gateway.setPolicy(alice.address, 2, 0, 200_000);

            const [usdcCost] = await gateway.estimateUsdcCost(
                alice.address,
                100_000,
                1_000_000_000
            );
            expect(usdcCost).to.be.gt(0);
        });
    });
});