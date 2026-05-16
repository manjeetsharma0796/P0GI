/**
 * gen-wallets.ts -- Generate 4 agent wallets + 1 gas-station wallet for 0G Chain.
 *
 * Usage:  bun run 0g/scripts/gen-wallets.ts
 *
 * Idempotent: if wallets.json already exists, prints existing addresses.
 * Wallet file: 0g/data/wallets.json
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const AGENT_NAMES = ["Llama", "Mistral", "Nemotron", "Qwen"] as const;
const GAS_STATION = "gas-station";

type WalletEntry = { address: string; privateKey: string };
type WalletsFile = Record<string, WalletEntry>;

const WALLETS_DIR = path.resolve(__dirname, "..", "data");
const WALLETS_PATH = path.join(WALLETS_DIR, "wallets.json");

function printAddresses(wallets: WalletsFile): void {
  console.log("\n--- 0G Agent Wallets ---\n");
  for (const name of [...AGENT_NAMES, GAS_STATION]) {
    const entry = wallets[name];
    if (entry) {
      console.log(`  ${name.padEnd(14)} ${entry.address}`);
    }
  }
  console.log(
    "\nFund these addresses with 0G testnet tokens from https://faucet.0g.ai",
  );
  console.log();
}

function main(): void {
  // Idempotent: if wallets already exist, just print them
  if (fs.existsSync(WALLETS_PATH)) {
    console.log(`wallets.json already exists at ${WALLETS_PATH}`);
    const existing: WalletsFile = JSON.parse(
      fs.readFileSync(WALLETS_PATH, "utf-8"),
    );
    printAddresses(existing);
    return;
  }

  const wallets: WalletsFile = {};

  // Generate 4 agent wallets
  for (const name of AGENT_NAMES) {
    const w = ethers.Wallet.createRandom();
    wallets[name] = {
      address: w.address,
      privateKey: w.privateKey,
    };
  }

  // Generate 1 gas-station wallet
  const gasWallet = ethers.Wallet.createRandom();
  wallets[GAS_STATION] = {
    address: gasWallet.address,
    privateKey: gasWallet.privateKey,
  };

  // Ensure data directory exists
  if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
  }

  fs.writeFileSync(WALLETS_PATH, JSON.stringify(wallets, null, 2), "utf-8");
  console.log(`Wallets saved to ${WALLETS_PATH}`);

  printAddresses(wallets);
}

main();
