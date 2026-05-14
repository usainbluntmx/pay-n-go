import { HardhatRuntimeEnvironment } from "hardhat/types";
import "hardhat-deploy/dist/src/type-extensions";
import { DeployFunction } from "hardhat-deploy/types";

// USDC oficial en Ethereum Sepolia
const USDC_ETHEREUM_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();

    log(`\n📡 Deploying PayNGoLinks to ${network.name}...`);
    log(`   Deployer:      ${deployer}`);
    log(`   USDC address:  ${USDC_ETHEREUM_SEPOLIA}`);
    log(`   Fee recipient: ${deployer}\n`);

    const result = await deploy("PayNGoLinks", {
        from: deployer,
        args: [
            deployer,                  // feeRecipient (tu wallet por ahora)
            USDC_ETHEREUM_SEPOLIA,     // USDC en Ethereum Sepolia
        ],
        log: true,
        waitConfirmations: network.name === "hardhat" ? 1 : 3,
    });

    log(`\n✅ PayNGoLinks deployed at: ${result.address}`);

    // Verificar en Etherscan si no es local
    if (network.name !== "hardhat" && network.name !== "localhost") {
        log(`\n🔍 Verifying on Etherscan...`);
        try {
            await hre.run("verify:verify", {
                address: result.address,
                constructorArguments: [deployer, USDC_ETHEREUM_SEPOLIA],
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

func.tags = ["PayNGoLinks"];
export default func;