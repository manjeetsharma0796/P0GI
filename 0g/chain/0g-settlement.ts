/**
 * 0g-settlement.ts -- ERC20 CHIP token settlement on 0G Chain.
 *
 * Unit mapping (CHIP has 18 decimals, same as ETH):
 *   game world uses "cents" (100 cents = 1 CHIP)
 *   1 game-cent  = 10^16 wei (0.01 CHIP)
 *   1 game-dollar = 10^18 wei (1 CHIP)
 *   An agent with 1000 CHIP has $1000 game-dollars = 100,000 cents
 *
 * Exports mirror the same interface so game-manager can swap imports.
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

/** 1 game-cent = 10^16 wei = 0.01 CHIP */
const WEI_PER_CENT = BigInt("10000000000000000"); // 10^16

const AGENT_NAMES: readonly AgentName[] = ["Llama", "Mistral", "Nemotron", "Qwen"];

/** Minimal ERC20 ABI for transfer + balanceOf */
const ERC20_ABI = [
  "function transfer(address to, uint256 value) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
] as const;

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
// Provider / Signer / Token Contract
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

function getChipTokenAddress(): string {
  const addr = process.env.ZG_CHIP_TOKEN_ADDRESS;
  if (!addr) throw new Error("ZG_CHIP_TOKEN_ADDRESS not set in env");
  return addr;
}

function getChipContract(signerOrProvider: ethers.Wallet | ethers.JsonRpcProvider): ethers.Contract {
  return new ethers.Contract(getChipTokenAddress(), ERC20_ABI, signerOrProvider);
}

// ---------------------------------------------------------------------------
// Exported API -- same signatures as before
// ---------------------------------------------------------------------------

/**
 * Load agent wallets from wallets.json.
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
 * Query CHIP token balance and return it in game-cents.
 */
export async function getBalance(address: string): Promise<number> {
  try {
    const chip = getChipContract(getProvider());
    const wei: bigint = await chip.balanceOf(address);
    return weiToCents(wei);
  } catch (err) {
    console.error(`[0g-settlement] getBalance failed for ${address}:`, (err as Error).message);
    return 0;
  }
}

/**
 * Alias for getBalance -- kept for call-site compatibility.
 */
export async function getUsdcBalanceCents(address: string): Promise<number> {
  return getBalance(address);
}

/**
 * Transfer CHIP tokens from one agent/pot wallet to another.
 * Returns the on-chain transaction hash.
 */
export async function settleBet(
  fromAddress: string,
  toAddress: string,
  amountCents: number,
): Promise<TxHash> {
  const signer = getSigner(fromAddress);
  const chip = getChipContract(signer);
  const value = centsToWei(amountCents);

  console.log(
    `[0g-settlement] settleBet: ${fromAddress.slice(0, 10)}... -> ${toAddress.slice(0, 10)}... | ${amountCents} cents (${ethers.formatEther(value)} CHIP)`,
  );

  try {
    const tx = await chip.transfer(toAddress, value);
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
