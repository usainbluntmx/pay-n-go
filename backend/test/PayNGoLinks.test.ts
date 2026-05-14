import { expect } from "chai";
import { ethers } from "hardhat";
import { PayNGoLinks } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Mock ERC20 para tests locales
const ERC20_ABI = [
    "function transfer(address to, uint amount) returns (bool)",
    "function approve(address spender, uint amount) returns (bool)",
    "function balanceOf(address owner) view returns (uint)",
    "function mint(address to, uint amount)",
];

describe("PayNGoLinks", () => {
    let contract: PayNGoLinks;
    let mockUSDC: Awaited<ReturnType<typeof ethers.deployContract>>;
    let owner: HardhatEthersSigner;
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let feeRecipient: HardhatEthersSigner;

    const USDC_DECIMALS = 6;
    const ONE_USDC = ethers.parseUnits("1", USDC_DECIMALS);
    const HUNDRED_USDC = ethers.parseUnits("100", USDC_DECIMALS);

    beforeEach(async () => {
        [owner, alice, bob, feeRecipient] = await ethers.getSigners();

        // Deploy MockERC20 (simula USDC en local)
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
        await mockUSDC.waitForDeployment();

        // Deploy PayNGoLinks
        const PayNGoLinks = await ethers.getContractFactory("PayNGoLinks");
        contract = await PayNGoLinks.deploy(
            feeRecipient.address,
            await mockUSDC.getAddress()
        );
        await contract.waitForDeployment();

        // Mint USDC para alice (el que va a pagar)
        await mockUSDC.mint(alice.address, HUNDRED_USDC);

        // Alice aprueba al contrato
        await mockUSDC
            .connect(alice)
            .approve(await contract.getAddress(), HUNDRED_USDC);
    });

    // ─── createLink ───────────────────────────────────────────────

    describe("createLink", () => {
        it("crea un link permanente correctamente", async () => {
            const tx = await contract
                .connect(owner)
                .createLink(bob.address, await mockUSDC.getAddress(), ONE_USDC, 0, "Pago por servicio");

            const receipt = await tx.wait();
            expect(receipt?.status).to.equal(1);

            const link = await contract.getLink(1);
            expect(link.id).to.equal(1);
            expect(link.creator).to.equal(owner.address);
            expect(link.recipient).to.equal(bob.address);
            expect(link.amount).to.equal(ONE_USDC);
            expect(link.expiresAt).to.equal(0);
            expect(link.status).to.equal(0); // Active
        });

        it("crea un link con expiración correctamente", async () => {
            const ONE_HOUR = 3600;
            await contract
                .connect(owner)
                .createLink(bob.address, await mockUSDC.getAddress(), ONE_USDC, ONE_HOUR, "");

            const link = await contract.getLink(1);
            expect(link.expiresAt).to.be.gt(0);
        });

        it("revierte si el token no está soportado", async () => {
            const fakeToken = ethers.ZeroAddress;
            await expect(
                contract.connect(owner).createLink(bob.address, fakeToken, ONE_USDC, 0, "")
            ).to.be.revertedWithCustomError(contract, "TokenNotSupported");
        });

        it("revierte si el monto es 0", async () => {
            await expect(
                contract
                    .connect(owner)
                    .createLink(bob.address, await mockUSDC.getAddress(), 0, 0, "")
            ).to.be.revertedWithCustomError(contract, "InvalidAmount");
        });

        it("revierte si el recipient es address(0)", async () => {
            await expect(
                contract
                    .connect(owner)
                    .createLink(ethers.ZeroAddress, await mockUSDC.getAddress(), ONE_USDC, 0, "")
            ).to.be.revertedWithCustomError(contract, "InvalidRecipient");
        });
    });

    // ─── payLink ──────────────────────────────────────────────────

    describe("payLink", () => {
        beforeEach(async () => {
            // Bob crea un link por 10 USDC
            await contract
                .connect(bob)
                .createLink(
                    bob.address,
                    await mockUSDC.getAddress(),
                    ethers.parseUnits("10", USDC_DECIMALS),
                    0,
                    "Test payment"
                );
        });

        it("ejecuta el pago correctamente y distribuye fee", async () => {
            const amount = ethers.parseUnits("10", USDC_DECIMALS);
            const fee = (amount * 50n) / 10000n; // 0.5%
            const amountToRecipient = amount - fee;

            const bobBefore = await mockUSDC.balanceOf(bob.address);
            const feeBefore = await mockUSDC.balanceOf(feeRecipient.address);

            await contract.connect(alice).payLink(1);

            const bobAfter = await mockUSDC.balanceOf(bob.address);
            const feeAfter = await mockUSDC.balanceOf(feeRecipient.address);

            expect(bobAfter - bobBefore).to.equal(amountToRecipient);
            expect(feeAfter - feeBefore).to.equal(fee);
        });

        it("marca el link como Paid después del pago", async () => {
            await contract.connect(alice).payLink(1);
            const link = await contract.getLink(1);
            expect(link.status).to.equal(1); // Paid
            expect(link.paidBy).to.equal(alice.address);
        });

        it("revierte si el link ya fue pagado", async () => {
            await contract.connect(alice).payLink(1);
            await expect(
                contract.connect(alice).payLink(1)
            ).to.be.revertedWithCustomError(contract, "LinkNotActive");
        });

        it("revierte si el link ha expirado", async () => {
            // Crear link con expiración de 1 hora
            await contract
                .connect(bob)
                .createLink(
                    bob.address,
                    await mockUSDC.getAddress(),
                    ONE_USDC,
                    3600,
                    ""
                );

            // Avanzar el tiempo 2 horas
            await time.increase(7200);

            await expect(
                contract.connect(alice).payLink(2)
            ).to.be.revertedWithCustomError(contract, "LinkExpired");
        });
    });

    // ─── cancelLink ───────────────────────────────────────────────

    describe("cancelLink", () => {
        beforeEach(async () => {
            await contract
                .connect(owner)
                .createLink(bob.address, await mockUSDC.getAddress(), ONE_USDC, 0, "");
        });

        it("el creador puede cancelar un link activo", async () => {
            await contract.connect(owner).cancelLink(1);
            const link = await contract.getLink(1);
            expect(link.status).to.equal(2); // Cancelled
        });

        it("revierte si no eres el creador", async () => {
            await expect(
                contract.connect(alice).cancelLink(1)
            ).to.be.revertedWithCustomError(contract, "NotLinkCreator");
        });
    });

    // ─── Vistas ───────────────────────────────────────────────────

    describe("vistas", () => {
        it("getLinksByCreator retorna los IDs correctos", async () => {
            await contract
                .connect(owner)
                .createLink(bob.address, await mockUSDC.getAddress(), ONE_USDC, 0, "");
            await contract
                .connect(owner)
                .createLink(alice.address, await mockUSDC.getAddress(), ONE_USDC, 0, "");

            const ids = await contract.getLinksByCreator(owner.address);
            expect(ids.length).to.equal(2);
            expect(ids[0]).to.equal(1);
            expect(ids[1]).to.equal(2);
        });

        it("isLinkPayable retorna false para link expirado", async () => {
            await contract
                .connect(owner)
                .createLink(bob.address, await mockUSDC.getAddress(), ONE_USDC, 3600, "");

            await time.increase(7200);

            expect(await contract.isLinkPayable(1)).to.equal(false);
        });
    });
});