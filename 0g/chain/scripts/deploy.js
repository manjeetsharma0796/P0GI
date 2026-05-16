import hre from "hardhat";

async function main() {
  const network = hre.network.name;
  console.log(`Deploying AgentBetGame to ${network}...`);

  const AgentBetGame = await hre.ethers.getContractFactory("AgentBetGame");
  const contract = await AgentBetGame.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();
  console.log(`AgentBetGame deployed at: ${address}`);
  console.log(`Transaction hash: ${deployTx.hash}`);

  const confirmations = network.includes("mainnet") ? 5 : 3;
  console.log(`Waiting for ${confirmations} confirmations...`);
  await deployTx.wait(confirmations);

  const explorerBase = network === "0g-mainnet"
    ? "https://chainscan.0g.ai"
    : "https://chainscan-galileo.0g.ai";
  console.log(`Explorer: ${explorerBase}/address/${address}`);

  console.log("Verifying contract...");
  try {
    await hre.run("verify:verify", {
      address,
      constructorArguments: [],
    });
    console.log("Contract verified.");
  } catch (err) {
    if (err.message.includes("already verified")) {
      console.log("Contract already verified.");
    } else {
      console.error("Verification failed:", err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
