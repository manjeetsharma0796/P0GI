/**
 * fund-agents.ts -- Fund agent wallets with CHIP tokens + gas A0GI on 0G Testnet.
 *
 * Usage:
 *   bun run 0g/scripts/fund-agents.ts
 *
 * Env (from .env.local):
 *   FUNDER_PRIVATE_KEY       (required) - private key of wallet holding CHIP + A0GI
 *   ZG_CHIP_TOKEN_ADDRESS    (required) - deployed CHIPToken contract address
 *   CHIP_AMOUNT              (optional) - CHIP per agent, default 10000
 *   GAS_AMOUNT               (optional) - A0GI per agent for gas, default 0.01
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = 16602;
const AGENT_NAMES = ["Llama", "Mistral", "Nemotron", "Qwen"] as const;
const GAS_STATION = "gas-station";

const ERC20_ABI = [
  "function transfer(address to, uint256 value) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)",
] as const;

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
    console.error("ERROR: Set FUNDER_PRIVATE_KEY env var.");
    process.exit(1);
  }

  const chipTokenAddr = process.env.ZG_CHIP_TOKEN_ADDRESS;
  if (!chipTokenAddr) {
    console.error("ERROR: Set ZG_CHIP_TOKEN_ADDRESS env var (deployed CHIPToken address).");
    process.exit(1);
  }

  const chipPerAgent = process.env.CHIP_AMOUNT ?? "10000";
  const gasPerAgent = process.env.GAS_AMOUNT ?? "0.01";

  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const funder = new ethers.Wallet(funderKey, provider);
  const chip = new ethers.Contract(chipTokenAddr, ERC20_ABI, funder);

  console.log(`Funder:     ${funder.address}`);
  const funderA0GI = await provider.getBalance(funder.address);
  const funderCHIP: bigint = await chip.balanceOf(funder.address);
  console.log(`A0GI bal:   ${ethers.formatEther(funderA0GI)} A0GI`);
  console.log(`CHIP bal:   ${ethers.formatEther(funderCHIP)} CHIP`);
  console.log(`Token:      ${chipTokenAddr}\n`);

  const wallets = loadWallets();

  // Build funding plan
  const targets: { name: string; address: string }[] = [];
  for (const name of AGENT_NAMES) {
    const entry = wallets[name];
    if (entry) targets.push({ name, address: entry.address });
  }
  const gs = wallets[GAS_STATION];
  if (gs) targets.push({ name: GAS_STATION, address: gs.address });

  const chipWei = ethers.parseEther(chipPerAgent);
  const gasWei = ethers.parseEther(gasPerAgent);
  const totalChip = chipWei * BigInt(targets.length);

  console.log(`Sending ${chipPerAgent} CHIP + ${gasPerAgent} A0GI to each of ${targets.length} wallets`);
  console.log(`Total CHIP needed: ${ethers.formatEther(totalChip)}\n`);

  if (funderCHIP < totalChip) {
    console.error(`ERROR: Not enough CHIP. Have ${ethers.formatEther(funderCHIP)}, need ${ethers.formatEther(totalChip)}`);
    process.exit(1);
  }

  // Send CHIP tokens + gas A0GI sequentially
  for (const { name, address } of targets) {
    try {
      // Send CHIP
      console.log(`  ${name}: sending ${chipPerAgent} CHIP...`);
      const chipTx = await chip.transfer(address, chipWei);
      await chipTx.wait(1);
      console.log(`    CHIP tx: ${chipTx.hash}`);

      // Send gas A0GI
      console.log(`  ${name}: sending ${gasPerAgent} A0GI for gas...`);
      const gasTx = await funder.sendTransaction({ to: address, value: gasWei });
      await gasTx.wait(1);
      console.log(`    A0GI tx: ${gasTx.hash}`);
    } catch (err) {
      console.error(`  FAILED ${name}: ${(err as Error).message}`);
    }
  }

  // Print final balances
  console.log("\n── Balances After Funding ──\n");
  for (const { name, address } of targets) {
    const a0gi = await provider.getBalance(address);
    const chipBal: bigint = await chip.balanceOf(address);
    console.log(`  ${name.padEnd(14)} ${ethers.formatEther(chipBal).padStart(12)} CHIP  |  ${ethers.formatEther(a0gi).padStart(10)} A0GI  (${address})`);
  }

  const funderA0GIAfter = await provider.getBalance(funder.address);
  const funderCHIPAfter: bigint = await chip.balanceOf(funder.address);
  console.log(`\n  Funder         ${ethers.formatEther(funderCHIPAfter).padStart(12)} CHIP  |  ${ethers.formatEther(funderA0GIAfter).padStart(10)} A0GI  (${funder.address})\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
