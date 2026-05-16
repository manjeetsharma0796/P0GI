/**
 * 0g-settlement.ts -- Drop-in replacement for modules/chain/settlement.ts
 * using 0G Chain native tokens instead of Initia uchip.
 *
 * Unit mapping:
 *   game world uses "cents" (100 cents = 1 "game dollar")
 *   0G native token has 18 decimals (like ETH)
 *   1 game-cent  = 0.0001 0G = 10^14 wei
 *   1 game-dollar = 0.01 0G
 *   An agent with 0.1 0G has $10 game-dollars = 1000 cents
 *
 * Exports mirror modules/chain/settlement.ts so game-manager can swap imports.
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import type { AgentName, Wallet, TxHash } from "../../modules/shared/types";
import { recordHandOnZgChain } from "./0g-chain";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TESTNET_RPC = "https://evmrpc-testnet.0g.ai";
const CHAIN_ID = 16602;
const TESTNET_EXPLORER = "https://chainscan-galileo.0g.ai";

/** 1 game-cent = 10^14 wei = 0.0001 0G */
const WEI_PER_CENT = BigInt("100000000000000"); // 10^14

const AGENT_NAMES: readonly AgentName[] = ["Llama", "Mistral", "Nemotron", "Qwen"];

// ---------------------------------------------------------------------------
// Unit conversion helpers (exported for testing)
// ---------------------------------------------------------------------------

export const centsToWei = (cents: number): bigint => BigInt(cents) * WEI_PER_CENT;
export const weiToCents = (wei: bigint): number => Number(wei / WEI_PER_CENT);

// ---------------------------------------------------------------------------
// Wallet file helpers
// ---------------------------------------------------------------------------

type WalletEntry = { address: string; privateKey: string };
type WalletsFile = Record<string, WalletEntry>;

const WALLETS_PATH = path.resolve(__dirname, "..", "data", "wallets.json");

let _walletsCache: WalletsFile | null = null;

function loadWallets(): WalletsFile {
  if (_walletsCache) return _walletsCache;
  if (!fs.existsSync(WALLETS_PATH)) {
    throw new Error(
      `wallets.json not found at ${WALLETS_PATH}. Run 0g/scripts/gen-wallets.ts first.`,
    );
  }
  _walletsCache = JSON.parse(fs.readFileSync(WALLETS_PATH, "utf-8"));
  return _walletsCache!;
}

function getPrivateKeyForAddress(address: string): string {
  const wallets = loadWallets();
  const lower = address.toLowerCase();
  for (const [, entry] of Object.entries(wallets)) {
    if (entry.address.toLowerCase() === lower) {
      return entry.privateKey;
    }
  }
  throw new Error(`No private key found for address ${address} in wallets.json`);
}

// ---------------------------------------------------------------------------
// Provider / Signer
// ---------------------------------------------------------------------------

let _provider: ethers.JsonRpcProvider | null = null;

function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpc = process.env.ZG_RPC_URL || TESTNET_RPC;
    _provider = new ethers.JsonRpcProvider(rpc, CHAIN_ID);
  }
  return _provider;
}

function getSigner(address: string): ethers.Wallet {
  const pk = getPrivateKeyForAddress(address);
  return new ethers.Wallet(pk, getProvider());
}

// ---------------------------------------------------------------------------
// Exported API -- same signatures as modules/chain/settlement.ts
// ---------------------------------------------------------------------------

/**
 * Load agent wallets from wallets.json and return them in the format
 * game-manager expects. _startingBalance is accepted for signature
 * compatibility but not used (balances come from on-chain state).
 */
export async function setupAllWallets(
  agentNames: AgentName[],
  _startingBalance: number,
): Promise<Record<AgentName, Wallet>> {
  const wallets = loadWallets();
  const out: Partial<Record<AgentName, Wallet>> = {};

  for (const name of agentNames) {
    const entry = wallets[name];
    if (!entry) {
      throw new Error(`No wallet entry for agent "${name}" in wallets.json`);
    }
    out[name] = { address: entry.address, agentName: name };
  }

  return out as Record<AgentName, Wallet>;
}

/**
 * Return the gas-station address (acts as the house/pot wallet).
 */
export function getPotAddress(): string {
  const wallets = loadWallets();
  const gs = wallets["gas-station"];
  if (!gs) {
    throw new Error("No gas-station wallet in wallets.json");
  }
  return gs.address;
}

/**
 * Query on-chain 0G balance and return it in game-cents.
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const provider = getProvider();
    const wei = await provider.getBalance(address);
    return weiToCents(wei);
  } catch (err) {
    console.error(`[0g-settlement] getBalance failed for ${address}:`, (err as Error).message);
    return 0;
  }
}

/**
 * Alias for getBalance -- kept for call-site compatibility with the
 * original USDC-based settlement layer.
 */
export async function getUsdcBalanceCents(address: string): Promise<number> {
  return getBalance(address);
}

/**
 * Transfer native 0G from one agent/pot wallet to another.
 * Returns the on-chain transaction hash.
 */
export async function settleBet(
  fromAddress: string,
  toAddress: string,
  amountCents: number,
): Promise<TxHash> {
  const signer = getSigner(fromAddress);
  const value = centsToWei(amountCents);

  console.log(
    `[0g-settlement] settleBet: ${fromAddress.slice(0, 10)}... -> ${toAddress.slice(0, 10)}... | ${amountCents} cents (${ethers.formatEther(value)} 0G)`,
  );

  try {
    const tx = await signer.sendTransaction({ to: toAddress, value });
    const receipt = await tx.wait(1);
    console.log(`[0g-settlement] settleBet confirmed: ${receipt!.hash}`);
    return receipt!.hash;
  } catch (err) {
    console.error("[0g-settlement] settleBet failed:", (err as Error).message);
    throw err;
  }
}

/**
 * Send winnings from the gas-station (pot) wallet to the winner.
 */
export async function distributeWinnings(
  winnerAddress: string,
  amountCents: number,
): Promise<TxHash> {
  const potAddress = getPotAddress();
  return settleBet(potAddress, winnerAddress, amountCents);
}

/**
 * Record a settled hand on-chain via the AgentBetGame contract.
 * Non-fatal: if recording fails the game continues (settlements already done).
 */
export async function recordHandOnChain(params: {
  handId: number;
  tableId: number;
  winnerAddress: string;
  potCents: number;
  losers: { address: string; lossCents: number }[];
}): Promise<TxHash | null> {
  try {
    const potWei = centsToWei(params.potCents);
    const txHash = await recordHandOnZgChain({
      handId: params.handId,
      tableId: params.tableId,
      winners: [params.winnerAddress],
      payouts: [potWei],
      losers: params.losers.map((l) => l.address),
      pot: potWei,
    });
    console.log(`[0g-settlement] recordHandOnChain tx: ${txHash}`);
    return txHash;
  } catch (err) {
    console.warn(
      `[0g-settlement] recordHandOnChain failed (non-fatal): ${(err as Error).message?.slice(0, 120)}`,
    );
    return null;
  }
}

/**
 * Return a block explorer URL for a transaction hash.
 */
export const explorerTxUrl = (hash: string): string =>
  `${TESTNET_EXPLORER}/tx/${hash}`;
