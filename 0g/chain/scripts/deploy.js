import hre from "hardhat";

async function main() {
  const network = hre.network.name;
  const explorerBase = network === "0g-mainnet"
    ? "https://chainscan.0g.ai"
    : "https://chainscan-galileo.0g.ai";

  // ── Deploy AgentBetGame ───────────────────────────────────────────────────

  console.log(`\nDeploying AgentBetGame to ${network}...`);
  const AgentBetGame = await hre.ethers.getContractFactory("AgentBetGame");
  const game = await AgentBetGame.deploy();
  await game.waitForDeployment();
  const gameAddress = await game.getAddress();
  console.log(`AgentBetGame deployed at: ${gameAddress}`);
  console.log(`Explorer: ${explorerBase}/address/${gameAddress}`);

  // ── Deploy CHIPToken ──────────────────────────────────────────────────────

  const INITIAL_SUPPLY = hre.ethers.parseEther("1000000"); // 1M CHIP
  console.log(`\nDeploying CHIPToken to ${network} (supply: 1,000,000 CHIP)...`);
  const CHIPToken = await hre.ethers.getContractFactory("CHIPToken");
  const chip = await CHIPToken.deploy(INITIAL_SUPPLY);
  await chip.waitForDeployment();
  const chipAddress = await chip.getAddress();
  console.log(`CHIPToken deployed at: ${chipAddress}`);
  console.log(`Explorer: ${explorerBase}/address/${chipAddress}`);

  // ── Wait for confirmations ────────────────────────────────────────────────

  const confirmations = network.includes("mainnet") ? 5 : 3;
  console.log(`\nWaiting for ${confirmations} confirmations...`);
  await game.deploymentTransaction().wait(confirmations);
  await chip.deploymentTransaction().wait(confirmations);

  // ── Verify contracts ──────────────────────────────────────────────────────

  for (const { name, address, args } of [
    { name: "AgentBetGame", address: gameAddress, args: [] },
    { name: "CHIPToken", address: chipAddress, args: [INITIAL_SUPPLY] },
  ]) {
    console.log(`\nVerifying ${name}...`);
    try {
      await hre.run("verify:verify", { address, constructorArguments: args });
      console.log(`${name} verified.`);
    } catch (err) {
      if (err.message.includes("already verified")) {
        console.log(`${name} already verified.`);
      } else {
        console.error(`${name} verification failed:`, err.message);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log("\n══════════════════════════════════════════════════════");
  console.log("DEPLOYMENT COMPLETE");
  console.log("══════════════════════════════════════════════════════");
  console.log(`AgentBetGame:  ${gameAddress}`);
  console.log(`CHIPToken:     ${chipAddress}`);
  console.log(`\nAdd to .env.local:`);
  console.log(`  ZG_CONTRACT_ADDRESS=${gameAddress}`);
  console.log(`  ZG_CHIP_TOKEN_ADDRESS=${chipAddress}`);
  console.log("══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
