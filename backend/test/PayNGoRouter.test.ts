import { expect } from "chai";
import { ethers } from "hardhat";
import { PayNGoRouter, PayNGoLinks, MockERC20 } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("PayNGoRouter", () => {
    let router: PayNGoRouter;
    let links: PayNGoLinks;
    let mockUSDC: MockERC20;
    let owner: HardhatEthersSigner;
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let feeRecipient: HardhatEthersSigner;

    const USDC_DECIMALS = 6;
    const HUNDRED_USDC = ethers.parseUnits("100", USDC_DECIMALS);
    const TEN_USDC = ethers.parseUnits("10", USDC_DECIMALS);

    const getDeadline = async () => {
        const block = await ethers.provider.getBlock("latest");
        return block!.timestamp + 3600;
    };

    beforeEach(async () => {
        [owner, alice, bob, feeRecipient] = await ethers.getSigners();

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6) as MockERC20;
        await mockUSDC.waitForDeployment();

        const PayNGoLinks = await ethers.getContractFactory("PayNGoLinks");
        links = await PayNGoLinks.deploy(
            feeRecipient.address,
            await mockUSDC.getAddress()
        ) as PayNGoLinks;
        await links.waitForDeployment();

        const PayNGoRouter = await ethers.getContractFactory("PayNGoRouter");
        router = await PayNGoRouter.deploy(
            feeRecipient.address,
            await links.getAddress(),
            await mockUSDC.getAddress()
        ) as PayNGoRouter;
        await router.waitForDeployment();

        await mockUSDC.mint(alice.address, HUNDRED_USDC);
        await mockUSDC.connect(alice).approve(await router.getAddress(), HUNDRED_USDC);
    });

    // ─── Rutas ────────────────────────────────────────────────────

    describe("rutas", () => {
        it("tiene ruta directa USDC→USDC por defecto", async () => {
            const route = await router.getRoute(1);
            expect(route.active).to.equal(true);
            expect(route.routeType).to.equal(0);
        });

        it("owner puede agregar una nueva ruta", async () => {
            await router.addRoute(
                await mockUSDC.getAddress(),
                await mockUSDC.getAddress(),
                1,
                10,
                ethers.ZeroAddress
            );

            const route = await router.getRoute(2);
            expect(route.active).to.equal(true);
            expect(route.routeType).to.equal(1);
        });

        it("owner puede desactivar una ruta", async () => {
            await router.setRouteActive(1, false);
            const route = await router.getRoute(1);
            expect(route.active).to.equal(false);
        });

        it("no owner no puede agregar rutas", async () => {
            await expect(
                router.connect(alice).addRoute(
                    await mockUSDC.getAddress(),
                    await mockUSDC.getAddress(),
                    0,
                    0,
                    ethers.ZeroAddress
                )
            ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");
        });
    });

    // ─── Quotes ───────────────────────────────────────────────────

    describe("getQuotes", () => {
        it("retorna cotización para ruta directa", async () => {
            const quotes = await router.getQuotes(
                await mockUSDC.getAddress(),
                await mockUSDC.getAddress(),
                TEN_USDC
            );

            expect(quotes.length).to.be.gt(0);
            expect(quotes[0].available).to.equal(true);
            expect(quotes[0].amountOut).to.be.lt(TEN_USDC);
        });

        it("getBestRoute retorna la ruta con mayor amountOut", async () => {
            await router.addRoute(
                await mockUSDC.getAddress(),
                await mockUSDC.getAddress(),
                1,
                50,
                ethers.ZeroAddress
            );

            const [bestRouteId] = await router.getBestRoute(
                await mockUSDC.getAddress(),
                await mockUSDC.getAddress(),
                TEN_USDC
            );

            expect(bestRouteId).to.equal(1);
        });
    });

    // ─── executePayment ───────────────────────────────────────────

    describe("executePayment", () => {
        it("ejecuta pago directo correctamente", async () => {
            const bobBefore = await mockUSDC.balanceOf(bob.address);

            await router.connect(alice).executePayment({
                sender: alice.address,
                recipient: bob.address,
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockUSDC.getAddress(),
                amountIn: TEN_USDC,
                minAmountOut: ethers.parseUnits("9.9", USDC_DECIMALS),
                routeId: 0,
                deadline: await getDeadline(),
                orderId: ethers.ZeroHash,
            });

            const bobAfter = await mockUSDC.balanceOf(bob.address);
            expect(bobAfter).to.be.gt(bobBefore);
        });

        it("emite evento PaymentRouted", async () => {
            const tx = router.connect(alice).executePayment({
                sender: alice.address,
                recipient: bob.address,
                tokenIn: await mockUSDC.getAddress(),
                tokenOut: await mockUSDC.getAddress(),
                amountIn: TEN_USDC,
                minAmountOut: 0,
                routeId: 0,
                deadline: await getDeadline(),
                orderId: ethers.ZeroHash,
            });

            await expect(tx).to.emit(router, "PaymentRouted");
        });

        it("revierte si el deadline expiró", async () => {
            await expect(
                router.connect(alice).executePayment({
                    sender: alice.address,
                    recipient: bob.address,
                    tokenIn: await mockUSDC.getAddress(),
                    tokenOut: await mockUSDC.getAddress(),
                    amountIn: TEN_USDC,
                    minAmountOut: 0,
                    routeId: 0,
                    deadline: Math.floor(Date.now() / 1000) - 10,
                    orderId: ethers.ZeroHash,
                })
            ).to.be.revertedWithCustomError(router, "DeadlineExpired");
        });

        it("revierte si slippage excedido", async () => {
            await expect(
                router.connect(alice).executePayment({
                    sender: alice.address,
                    recipient: bob.address,
                    tokenIn: await mockUSDC.getAddress(),
                    tokenOut: await mockUSDC.getAddress(),
                    amountIn: TEN_USDC,
                    minAmountOut: TEN_USDC,
                    routeId: 0,
                    deadline: await getDeadline(),
                    orderId: ethers.ZeroHash,
                })
            ).to.be.revertedWithCustomError(router, "SlippageExceeded");
        });

        it("revierte si el monto es 0", async () => {
            await expect(
                router.connect(alice).executePayment({
                    sender: alice.address,
                    recipient: bob.address,
                    tokenIn: await mockUSDC.getAddress(),
                    tokenOut: await mockUSDC.getAddress(),
                    amountIn: 0,
                    minAmountOut: 0,
                    routeId: 0,
                    deadline: await getDeadline(),
                    orderId: ethers.ZeroHash,
                })
            ).to.be.revertedWithCustomError(router, "InvalidAmount");
        });

        it("revierte si recipient es address(0)", async () => {
            await expect(
                router.connect(alice).executePayment({
                    sender: alice.address,
                    recipient: ethers.ZeroAddress,
                    tokenIn: await mockUSDC.getAddress(),
                    tokenOut: await mockUSDC.getAddress(),
                    amountIn: TEN_USDC,
                    minAmountOut: 0,
                    routeId: 0,
                    deadline: await getDeadline(),
                    orderId: ethers.ZeroHash,
                })
            ).to.be.revertedWithCustomError(router, "InvalidRecipient");
        });
    });
});