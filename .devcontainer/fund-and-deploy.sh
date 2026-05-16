#!/usr/bin/env bash
# Assumes setup-rollup.sh already ran and minitiad is up.
# Creates (or reuses) 4 agent wallets, funds each with 10K CHIP from
# gas-station, deploys the agentbet::game Move module, and writes the
# resulting addresses into modules/shared/chain.ts.
set -eu

cd "$(dirname "$0")/.."

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
NODE=http://localhost:26657
CHAIN=agentbet-1
GAS_PRICES=0.15uchip
FUND_AMOUNT=10000000000uchip   # 10,000 CHIP

# ── sanity check ──
if ! curl -s --max-time 3 "$NODE/status" | grep -q "latest_block_height"; then
  echo -e "${YELLOW}Rollup is not answering on $NODE.${RESET}"
  echo "Run .devcontainer/setup-rollup.sh first."
  exit 1
fi
if ! minitiad keys show gas-station --keyring-backend test >/dev/null 2>&1; then
  echo -e "${YELLOW}gas-station key missing from minitiad keyring.${RESET}"
  exit 1
fi

# ── 1. create agent keys (idempotent) ──
echo "── creating agent wallets ──"
for a in llama qwen mistral nemotron; do
  if minitiad keys show "$a" --keyring-backend test >/dev/null 2>&1; then
    echo "   $a: already exists"
  else
    minitiad keys add "$a" --keyring-backend test --coin-type 60 --key-type eth_secp256k1 >/dev/null
    echo -e "   ${GREEN}✓ created $a${RESET}"
  fi
done

# ── 2. fund each agent from gas-station ──
echo ""
echo "── funding agents ──"
for a in llama qwen mistral nemotron; do
  addr=$(minitiad keys show "$a" --keyring-backend test -a)
  current=$(minitiad query bank balances "$addr" --node "$NODE" --output json 2>/dev/null | jq -r '.balances[] | select(.denom=="uchip") | .amount' || echo "0")
  current=${current:-0}
  if [ "$current" -ge 1000000000 ]; then
    echo "   $a: already has $(echo "scale=2; $current / 1000000" | bc) CHIP — skipping"
    continue
  fi
  echo -n "   funding $a ($addr) … "
  minitiad tx bank send gas-station "$addr" "$FUND_AMOUNT" \
    --keyring-backend test --from gas-station \
    --gas auto --gas-adjustment 1.5 --gas-prices "$GAS_PRICES" \
    --node "$NODE" --chain-id "$CHAIN" --yes 2>&1 \
    | grep -E "^txhash:" || true
  sleep 3
done

# ── 3. print summary ──
echo ""
echo "── agent balances ──"
declare -A ADDR
for a in llama qwen mistral nemotron; do
  addr=$(minitiad keys show "$a" --keyring-backend test -a)
  ADDR[$a]=$addr
  bal=$(minitiad query bank balances "$addr" --node "$NODE" --output json | jq -r '.balances[] | select(.denom=="uchip") | .amount')
  printf "   %-10s %s  %s uchip\n" "$a" "$addr" "${bal:-0}"
done

# ── 4. deploy Move module (agentbet::game) ──
echo ""
echo "── pre-cloning Move stdlib dep (shallow) ──"
MOVE_CACHE="$HOME/.move/https___github_com_initia-labs_movevm_git_main"
if [ ! -d "$MOVE_CACHE" ]; then
  mkdir -p "$HOME/.move"
  git clone --depth 1 --branch main \
    https://github.com/initia-labs/movevm.git "$MOVE_CACHE" 2>&1 | tail -3
fi

GS_HEX=$(minitiad keys parse "$(minitiad keys show gas-station -a --keyring-backend test)" 2>&1 | grep "bytes:" | awk '{print $2}' | tr 'A-Z' 'a-z')
GS_HEX_0X="0x${GS_HEX}"

echo ""
echo "── rewriting move/Move.toml with this Codespace's gas-station address ──"
cat > move/Move.toml <<EOF
[package]
name = "agentbet"
version = "0.0.1"

[dependencies]
InitiaStdlib = { git = "https://github.com/initia-labs/movevm.git", subdir = "precompile/modules/initia_stdlib", rev = "main" }

[addresses]
agentbet = "${GS_HEX_0X}"
std = "0x1"
initia_std = "0x1"
EOF
echo "   agentbet = ${GS_HEX_0X}"

echo ""
echo "── building move module ──"
MOVE_BUILD_DIR="$HOME/move-build"
rm -rf "$MOVE_BUILD_DIR"
cp -r move "$MOVE_BUILD_DIR"
(cd "$MOVE_BUILD_DIR" && minitiad move build --path .) 2>&1 | tail -8

echo ""
echo "── deploying ──"
DEPLOY_OUT=$(cd "$MOVE_BUILD_DIR" && minitiad move deploy --path . \
  --upgrade-policy COMPATIBLE \
  --from gas-station --keyring-backend test \
  --gas auto --gas-adjustment 1.5 --gas-prices "$GAS_PRICES" \
  --node "$NODE" --chain-id "$CHAIN" --yes 2>&1)
echo "$DEPLOY_OUT" | grep -E "^(code|txhash):" | head
DEPLOY_TX=$(echo "$DEPLOY_OUT" | awk '/^txhash:/ {print $2}')

echo ""
echo "── writing modules/shared/chain.ts ──"
cat > modules/shared/chain.ts <<EOF
export const INITIA_CHAIN = {
  l1: {
    chainId: "initiation-2",
    rpc: "https://rpc.testnet.initia.xyz",
    rest: "https://rest.testnet.initia.xyz",
    faucet: "https://faucet.testnet.initia.xyz",
    denom: "uinit",
    decimals: 6,
  },
  rollup: {
    chainId: "agentbet-1",
    rpc: process.env.ROLLUP_RPC || "http://localhost:26657",
    rest: process.env.ROLLUP_REST || "http://localhost:1317",
    indexer: process.env.ROLLUP_INDEXER || "http://localhost:8080",
    denom: "uchip",
    displayDenom: "CHIP",
    decimals: 6,
    gasPrices: "0.15uchip",
    bech32Prefix: "init",
  },
} as const

export const GAS_STATION_ADDRESS = "$(minitiad keys show gas-station -a --keyring-backend test)"

/** Deployed Move module on agentbet-1 (tx ${DEPLOY_TX}). */
export const GAME_MODULE = {
  address: "${GS_HEX_0X}",
  name: "game",
  entryFn: "record_hand",
} as const

export const AGENT_WALLETS: Record<string, { address: string; keyName: string }> = {
  Llama:    { address: "${ADDR[llama]}",    keyName: "llama" },
  Qwen:     { address: "${ADDR[qwen]}",     keyName: "qwen" },
  Mistral:  { address: "${ADDR[mistral]}",  keyName: "mistral" },
  Nemotron: { address: "${ADDR[nemotron]}", keyName: "nemotron" },
}

export const CHIP_PER_UCHIP = 1_000_000
export const toUchip = (chip: number) => Math.round(chip * CHIP_PER_UCHIP)
export const toChip = (uchip: number | string) =>
  Number(uchip) / CHIP_PER_UCHIP
EOF
echo -e "   ${GREEN}✓ modules/shared/chain.ts updated${RESET}"

# ── 5. generate .env.local with Codespace-aware URLs ──
echo ""
echo "── writing .env.local ──"
if [ -n "${CODESPACE_NAME:-}" ]; then
  DOMAIN=${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}
  RPC_URL="https://${CODESPACE_NAME}-26657.${DOMAIN}"
  REST_URL="https://${CODESPACE_NAME}-1317.${DOMAIN}"
  INDEXER_URL="https://${CODESPACE_NAME}-8080.${DOMAIN}"
  echo "   detected Codespace · using public forwarded URLs"
else
  RPC_URL="http://localhost:26657"
  REST_URL="http://localhost:1317"
  INDEXER_URL="http://localhost:8080"
  echo "   local env · using localhost URLs"
fi

GS_BECH32=$(minitiad keys show gas-station -a --keyring-backend test)
cat > .env.local <<EOF
# Auto-generated by .devcontainer/fund-and-deploy.sh
# Re-run that script any time the rollup is rebuilt.

# Browser-facing (must be reachable from the user's machine)
NEXT_PUBLIC_ROLLUP_CHAIN_ID=agentbet-1
NEXT_PUBLIC_ROLLUP_RPC=${RPC_URL}
NEXT_PUBLIC_ROLLUP_REST=${REST_URL}
NEXT_PUBLIC_ROLLUP_INDEXER=${INDEXER_URL}
NEXT_PUBLIC_SIDE_BET_ESCROW=${GS_BECH32}

# Server-facing (same VM as the rollup — always localhost)
ROLLUP_RPC=http://localhost:26657
ROLLUP_REST=http://localhost:1317
MINITIAD_PATH=minitiad
EOF
echo -e "   ${GREEN}✓ .env.local written${RESET}"
echo "   public RPC     ${RPC_URL}"
echo "   public REST    ${REST_URL}"
echo "   public indexer ${INDEXER_URL}"

echo ""
cat <<EOF
${GREEN}Done.${RESET}

  Chain id           agentbet-1
  Gas station addr   $(minitiad keys show gas-station -a --keyring-backend test)
  Gas station hex    ${GS_HEX_0X}
  Deployed module    ${GS_HEX_0X}::game
  Deploy tx          ${DEPLOY_TX}

Next:

  bun run play

Then open the "PORTS" tab in VS Code, right-click each of
  3000 (Next.js), 1317 (REST), 8080 (indexer), 3001 (socket.io)
→ Port Visibility: Public. Share the :3000 URL.
EOF
