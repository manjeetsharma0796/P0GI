import { ethers, type Log } from "ethers";
import type { TxHash } from "../../modules/shared/types";

const ABI = [
  "event HandSettled(uint256 indexed handId, uint256 indexed tableId, address[] winners, uint256[] payouts, address[] losers, uint256 pot)",
  "function recordHand(uint256 handId, uint256 tableId, address[] winners, uint256[] payouts, address[] losers, uint256 pot)",
] as const;

const TESTNET_RPC = "https://evmrpc-testnet.0g.ai";
const TESTNET_EXPLORER = "https://chainscan-galileo.0g.ai";

function getProvider(): ethers.JsonRpcProvider {
  const rpc = process.env.ZG_RPC_URL || TESTNET_RPC;
  return new ethers.JsonRpcProvider(rpc);
}

function getContract(): ethers.Contract {
  const address = process.env.ZG_CONTRACT_ADDRESS;
  if (!address) throw new Error("ZG_CONTRACT_ADDRESS not set");

  const pk = process.env.ZG_PRIVATE_KEY;
  if (!pk) throw new Error("ZG_PRIVATE_KEY not set");

  const provider = getProvider();
  const signer = new ethers.Wallet(pk, provider);
  return new ethers.Contract(address, ABI, signer);
}

function getReadOnlyContract(): ethers.Contract {
  const address = process.env.ZG_CONTRACT_ADDRESS;
  if (!address) throw new Error("ZG_CONTRACT_ADDRESS not set");
  return new ethers.Contract(address, ABI, getProvider());
}

interface RecordHandParams {
  handId: number;
  tableId: number;
  winners: string[];
  payouts: bigint[];
  losers: string[];
  pot: bigint;
}

export async function recordHandOnZgChain(params: RecordHandParams): Promise<TxHash> {
  const contract = getContract();
  const tx = await contract.recordHand(
    params.handId,
    params.tableId,
    params.winners,
    params.payouts,
    params.losers,
    params.pot,
  );
  const receipt = await tx.wait(1);
  return receipt.hash as TxHash;
}

export interface HandSettledEvent {
  handId: bigint;
  tableId: bigint;
  winners: string[];
  payouts: bigint[];
  losers: string[];
  pot: bigint;
  txHash: string;
  blockNumber: number;
}

export async function getHandSettledEvents(
  fromBlock: number,
  toBlock: number | "latest" = "latest",
): Promise<HandSettledEvent[]> {
  const contract = getReadOnlyContract();
  const filter = contract.filters.HandSettled();
  const logs: Log[] = await contract.queryFilter(filter, fromBlock, toBlock);

  return logs.map((log) => {
    const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
    if (!parsed) throw new Error(`Failed to parse log at tx ${log.transactionHash}`);
    return {
      handId: parsed.args.handId,
      tableId: parsed.args.tableId,
      winners: parsed.args.winners,
      payouts: parsed.args.payouts,
      losers: parsed.args.losers,
      pot: parsed.args.pot,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    };
  });
}

export function getExplorerTxUrl(txHash: string): string {
  const isMainnet = process.env.ZG_RPC_URL?.includes("evmrpc.0g.ai") &&
    !process.env.ZG_RPC_URL?.includes("testnet");
  const base = isMainnet ? "https://chainscan.0g.ai" : TESTNET_EXPLORER;
  return `${base}/tx/${txHash}`;
}
