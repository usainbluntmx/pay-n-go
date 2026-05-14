import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy/dist/src/type-extensions";

const USDC_ETHEREUM_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const PAYNGO_LINKS_ADDRESS = "0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log(`\n📡 Deploying PayNGoRouter to ${network.name}...`);
    log(`   Deployer:       ${deployer}`);
    log(`   USDC address:   ${USDC_ETHEREUM_SEPOLIA}`);
    log(`   PayNGoLinks:    ${PAYNGO_LINKS_ADDRESS}`);
    log(`   Fee recipient:  ${deployer}\n`);

    const result = await deploy("PayNGoRouter", {
        from: deployer,
        args: [
            deployer,
            PAYNGO_LINKS_ADDRESS,
            USDC_ETHEREUM_SEPOLIA,
        ],
        log: true,
        waitConfirmations: network.name === "hardhat" ? 1 : 3,
    });

    log(`\n✅ PayNGoRouter deployed at: ${result.address}`);

    if (network.name !== "hardhat" && network.name !== "localhost") {
        log(`\n🔍 Verifying on Etherscan...`);
        try {
            await hre.run("verify:verify", {
                address: result.address,
                constructorArguments: [deployer, PAYNGO_LINKS_ADDRESS, USDC_ETHEREUM_SEPOLIA],
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

func.tags = ["PayNGoRouter"];
func.dependencies = ["PayNGoLinks"];
export default func;