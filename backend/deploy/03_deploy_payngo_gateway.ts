import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy/dist/src/type-extensions";

const USDC_ETHEREUM_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const PAYNGO_ROUTER_ADDRESS = "0x43246220b9e7C3d4500c0f2B778C1C916a63a2FF";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log(`\n📡 Deploying PayNGoGateway to ${network.name}...`);
    log(`   Deployer:       ${deployer}`);
    log(`   USDC address:   ${USDC_ETHEREUM_SEPOLIA}`);
    log(`   PayNGoRouter:   ${PAYNGO_ROUTER_ADDRESS}\n`);

    const result = await deploy("PayNGoGateway", {
        from: deployer,
        args: [
            USDC_ETHEREUM_SEPOLIA,
            PAYNGO_ROUTER_ADDRESS,
        ],
        log: true,
        waitConfirmations: network.name === "hardhat" ? 1 : 3,
    });

    log(`\n✅ PayNGoGateway deployed at: ${result.address}`);

    if (network.name !== "hardhat" && network.name !== "localhost") {
        log(`\n🔍 Verifying on Etherscan...`);
        try {
            await hre.run("verify:verify", {
                address: result.address,
                constructorArguments: [USDC_ETHEREUM_SEPOLIA, PAYNGO_ROUTER_ADDRESS],
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