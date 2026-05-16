#!/usr/bin/env bash
# First-time rollup setup for a fresh Codespace.
#
# Walks you through `weave init` (interactive TUI), then automates the rest:
#   - funds the gas-station from the Initia testnet faucet
#   - starts minitiad
#   - imports the gas-station mnemonic into the minitiad keyring
#
# Subsequent Codespace starts resume the chain automatically via post-start.sh.
set -eu

cd "$(dirname "$0")/.."

BOLD=$'\e[1m'; DIM=$'\e[2m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'

if [ -f "$HOME/.minitia/config/genesis.json" ]; then
  echo -e "${YELLOW}A rollup already exists at ~/.minitia — skipping weave init.${RESET}"
  echo "If you really want to redo setup, run:"
  echo "   rm -rf ~/.weave ~/.minitia ~/.initia ~/.opinit"
  echo "Then re-run this script."
else
  cat <<EOF

${BOLD}── Interactive step · weave init ──${RESET}

You'll be walked through a ~15-prompt wizard. Use these answers:

  Gas Station account        → Generate new account
  (copy the printed address!)
  Fund the Gas Station       → open https://faucet.testnet.initia.xyz,
                               paste the address, submit,
                               then type ${GREEN}continue${RESET}
  What do you want to do?    → Launch a new rollup
  L1 network                 → Testnet (initiation-2)
  VM                         → Move
  Rollup chain ID            → ${GREEN}agentbet-1${RESET}
  Rollup gas denom           → ${GREEN}uchip${RESET}
  Node moniker               → (Tab for default)
  Submission Interval        → (Tab for default — 1m)
  Output Finalization Period → (Tab for default — 168h)
  DA                         → Initia L1
  Oracle price feed          → Enable
  System keys                → Generate new system keys
  System funding             → Use default preset
  Fee whitelist              → (Enter to leave empty)
  Gas Station to genesis     → Yes
  Genesis balance            → ${GREEN}10000000000000000000${RESET}   (10^19 uchip, Move safe max)
  Extra genesis accounts     → No
  Continue                   → type ${GREEN}continue${RESET}
  Confirm                    → ${GREEN}y${RESET}

${DIM}weave's last step registers the rollup as a systemd service;
that fails inside a container, which is harmless — the rollup is already
genesis'd and will be started manually below.${RESET}

Press ENTER to launch weave init now…
EOF
  read -r _

  weave init || true   # the systemd-service step errors cosmetically; chain state is still written
fi

echo ""
echo "── Starting minitiad ──"
if pgrep -x minitiad >/dev/null; then
  echo "already running"
else
  nohup minitiad start > "$HOME/.minitia/node.log" 2>&1 &
  disown || true
fi

echo ""
echo "── Waiting for rollup RPC to answer (up to 60s) ──"
for _ in $(seq 1 30); do
  if curl -s --max-time 2 http://localhost:26657/status 2>/dev/null | grep -q "latest_block_height"; then
    h=$(curl -s http://localhost:26657/status | jq -r '.result.sync_info.latest_block_height')
    echo -e "   ${GREEN}✓ rollup alive${RESET}  height=$h  chain=agentbet-1"
    break
  fi
  sleep 2
done

echo ""
echo "── Importing gas-station mnemonic into both keyrings ──"
MNEMONIC=$(jq -r '.common.gas_station.mnemonic' "$HOME/.weave/config.json" 2>/dev/null || true)
if [ -z "$MNEMONIC" ] || [ "$MNEMONIC" = "null" ]; then
  echo -e "${YELLOW}Could not find gas-station mnemonic in ~/.weave/config.json.${RESET}"
  echo "If weave init finished normally this shouldn't happen."
else
  for CLI in initiad minitiad; do
    if "$CLI" keys show gas-station --keyring-backend test >/dev/null 2>&1; then
      echo "   $CLI: gas-station already in keyring"
    else
      echo -n "$MNEMONIC" | "$CLI" keys add gas-station --recover --keyring-backend test \
        --coin-type 60 --key-type eth_secp256k1 --source /dev/stdin >/dev/null
      echo -e "   ${GREEN}✓ imported into $CLI${RESET}"
    fi
  done
fi

echo ""
cat <<EOF
${BOLD}── Next ──${RESET}

  bash .devcontainer/fund-and-deploy.sh   # creates 4 agent wallets + funds them,
                                           # deploys agentbet::game Move module,
                                           # writes modules/shared/chain.ts

  bun run play                             # starts Next.js + socket.io

EOF
