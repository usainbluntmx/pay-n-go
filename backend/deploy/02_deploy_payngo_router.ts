import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy/dist/src/type-extensions";

const USDC_ETHEREUM_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const PAYNGO_LINKS_ADDRESS = "0x1e6DFDac949089a02e48aBcb63E7381A3D77bF29";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts, network } = hre;
    const { deploy, log, get } = deployments;
    const { deployer } = await getNamedAccounts();

    log(`\n📡 Deploying PayNGoRouter to ${network.name}...`);

    const result = await deploy("PayNGoRouter", {
        from: deployer,
        args: [deployer, PAYNGO_LINKS_ADDRESS, USDC_ETHEREUM_SEPOLIA],
        log: true,
        waitConfirmations: network.name === "hardhat" ? 1 : 3,
    });

    log(`\n✅ PayNGoRouter deployed at: ${result.address}`);

    // Conectar con Gateway si ya está deployado
    try {
        const gateway = await get("PayNGoGateway");
        if (gateway.address) {
            log(`\n🔗 Connecting Router → Gateway...`);
            const router = await hre.ethers.getContractAt("PayNGoRouter", result.address);
            const tx = await router.setPayNGoGateway(gateway.address);
            await tx.wait();
            log(`✅ Router connected to Gateway: ${gateway.address}`);
        }
    } catch {
        log(`ℹ️  Gateway not deployed yet — connect manually after deploying Gateway`);
    }

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