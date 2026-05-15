import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy/dist/src/type-extensions";

const USDC_ETHEREUM_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, log, get } = deployments;
    const { deployer } = await getNamedAccounts();

    // Obtener address del Router ya deployado
    const router = await get("PayNGoRouter");

    log(`\n📡 Deploying PayNGoGateway to ${network.name}...`);
    log(`   USDC:          ${USDC_ETHEREUM_SEPOLIA}`);
    log(`   PayNGoRouter:  ${router.address}\n`);

    const result = await deploy("PayNGoGateway", {
        from: deployer,
        args: [USDC_ETHEREUM_SEPOLIA, router.address],
        log: true,
        waitConfirmations: network.name === "hardhat" ? 1 : 3,
    });

    log(`\n✅ PayNGoGateway deployed at: ${result.address}`);

    // Conectar Gateway → Router (setPayNGoGateway)
    log(`\n🔗 Connecting Gateway → Router...`);
    const routerContract = await hre.ethers.getContractAt("PayNGoRouter", router.address);
    const tx = await routerContract.setPayNGoGateway(result.address);
    await tx.wait();
    log(`✅ Router now points to Gateway: ${result.address}`);

    if (network.name !== "hardhat" && network.name !== "localhost") {
        log(`\n🔍 Verifying on Etherscan...`);
        try {
            await hre.run("verify:verify", {
                address: result.address,
                constructorArguments: [USDC_ETHEREUM_SEPOLIA, router.address],
            });
            log(`✅ Verified!`);
        } catch (e: unknown) {
            if (e instanceof Error && e.message.includes("Already Verified")) {
                log(`ℹ️  Already verified.`);
            } else {
                log(`⚠️  Verification failed: ${e}`);
            }
        }
    }
};

func.tags = ["PayNGoGateway"];
func.dependencies = ["PayNGoRouter"];
export default func;