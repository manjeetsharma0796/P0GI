/**
 * fund-agents.ts -- Fund agent wallets from a master wallet on 0G Testnet.
 *
 * Usage:
 *   FUNDER_PRIVATE_KEY=0x... bun run 0g/scripts/fund-agents.ts
 *   FUNDER_PRIVATE_KEY=0x... AGENT_AMOUNT=0.1 bun run 0g/scripts/fund-agents.ts
 *
 * Env:
 *   FUNDER_PRIVATE_KEY  (required) - private key of the wallet holding 0G tokens
 *   AGENT_AMOUNT        (optional) - 0G per agent, default 0.05
 *   GAS_STATION_AMOUNT  (optional) - 0G for gas-station, default 0.1
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = 16602;
const AGENT_NAMES = ["Llama", "Mistral", "Nemotron", "Qwen"] as const;
const GAS_STATION = "gas-station";

type WalletEntry = { address: string; privateKey: string };
type WalletsFile = Record<string, WalletEntry>;

const WALLETS_PATH = path.resolve(__dirname, "..", "data", "wallets.json");

function loadWallets(): WalletsFile {
  if (!fs.existsSync(WALLETS_PATH)) {
    throw new Error(
      `wallets.json not found at ${WALLETS_PATH}. Run gen-wallets.ts first.`,
    );
  }
  return JSON.parse(fs.readFileSync(WALLETS_PATH, "utf-8"));
}

async function main(): Promise<void> {
  const funderKey = process.env.FUNDER_PRIVATE_KEY;
  if (!funderKey) {
    console.error("ERROR: Set FUNDER_PRIVATE_KEY env var to the funder wallet private key.");
    process.exit(1);
  }

  const agentAmount = process.env.AGENT_AMOUNT ?? "0.05";
  const gasStationAmount = process.env.GAS_STATION_AMOUNT ?? "0.1";

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const funder = new ethers.Wallet(funderKey, provider);

  console.log(`Funder address: ${funder.address}`);
  const funderBal = await provider.getBalance(funder.address);
  console.log(`Funder balance: ${ethers.formatEther(funderBal)} 0G\n`);

  const wallets = loadWallets();

  // Build funding plan: agents + gas-station
  const plan: { name: string; address: string; amount: string }[] = [];

  for (const name of AGENT_NAMES) {
    const entry = wallets[name];
    if (!entry) {
      console.warn(`WARNING: No wallet entry for ${name}, skipping.`);
      continue;
    }
    plan.push({ name, address: entry.address, amount: agentAmount });
  }

  const gsEntry = wallets[GAS_STATION];
  if (gsEntry) {
    plan.push({ name: GAS_STATION, address: gsEntry.address, amount: gasStationAmount });
  } else {
    console.warn("WARNING: No gas-station wallet found, skipping.");
  }

  // Calculate total needed
  const totalNeeded = plan.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0,
  );
  console.log(`Total to send: ${totalNeeded} 0G across ${plan.length} wallets\n`);

  if (funderBal < ethers.parseEther(totalNeeded.toString())) {
    console.error(
      `ERROR: Funder balance (${ethers.formatEther(funderBal)} 0G) is less than needed (${totalNeeded} 0G).`,
    );
    process.exit(1);
  }

  // Send funds sequentially (avoids nonce issues)
  for (const { name, address, amount } of plan) {
    try {
      console.log(`Sending ${amount} 0G to ${name} (${address})...`);
      const tx = await funder.sendTransaction({
        to: address,
        value: ethers.parseEther(amount),
      });
      const receipt = await tx.wait(1);
      console.log(`  tx: ${receipt!.hash}`);
    } catch (err) {
      console.error(`  FAILED to fund ${name}: ${(err as Error).message}`);
    }
  }

  // Print final balances
  console.log("\n--- Balances After Funding ---\n");
  for (const { name, address } of plan) {
    const bal = await provider.getBalance(address);
    console.log(`  ${name.padEnd(14)} ${ethers.formatEther(bal)} 0G  (${address})`);
  }

  const funderBalAfter = await provider.getBalance(funder.address);
  console.log(`\n  Funder         ${ethers.formatEther(funderBalAfter)} 0G  (${funder.address})`);
  console.log();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
