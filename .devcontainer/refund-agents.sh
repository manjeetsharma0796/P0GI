#!/usr/bin/env bash
# Top every agent wallet back up to TARGET CHIP from the gas-station.
# Idempotent — only transfers if the agent's current balance is below
# the REFUND_THRESHOLD, so re-running is safe and cheap.
#
# Use when you see agent balances at 0 in the UI (lost a session / fresh rollup).
set -eu

cd "$(dirname "$0")/.."

GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
NODE=${ROLLUP_RPC:-http://localhost:26657}
CHAIN=${NEXT_PUBLIC_ROLLUP_CHAIN_ID:-agentbet-1}
GAS_PRICES=0.15uchip

TARGET_UCHIP=10000000000          # 10,000 CHIP per agent after refund
REFUND_THRESHOLD_UCHIP=1000000000 #  1,000 CHIP — below this triggers a top-up

# ── sanity ──
if ! curl -s --max-time 3 "$NODE/status" | grep -q "latest_block_height"; then
  echo -e "${YELLOW}Rollup not answering on $NODE — start it first:${RESET}"
  echo "   nohup minitiad start > ~/.minitia/node.log 2>&1 &"
  exit 1
fi
if ! minitiad keys show gas-station --keyring-backend test >/dev/null 2>&1; then
  echo -e "${YELLOW}gas-station key missing from minitiad keyring.${RESET}"
  echo "Run .devcontainer/setup-rollup.sh first to bootstrap."
  exit 1
fi

GS_BAL=$(minitiad query bank balances "$(minitiad keys show gas-station -a --keyring-backend test)" --node "$NODE" --output json 2>/dev/null | jq -r '.balances[] | select(.denom=="uchip") | .amount' || echo "0")
echo "gas-station balance: $(echo "scale=2; ${GS_BAL:-0} / 1000000" | bc 2>/dev/null || echo "$GS_BAL") CHIP"

echo ""
for a in llama qwen mistral nemotron; do
  if ! minitiad keys show "$a" --keyring-backend test >/dev/null 2>&1; then
    echo -e "   ${YELLOW}$a: no key — create with fund-and-deploy.sh${RESET}"
    continue
  fi
  addr=$(minitiad keys show "$a" --keyring-backend test -a)
  bal=$(minitiad query bank balances "$addr" --node "$NODE" --output json 2>/dev/null | jq -r '.balances[] | select(.denom=="uchip") | .amount' || echo "0")
  bal=${bal:-0}
  human=$(echo "scale=2; $bal / 1000000" | bc 2>/dev/null || echo "$bal")

  if [ "$bal" -ge "$REFUND_THRESHOLD_UCHIP" ]; then
    printf "   %-10s %-45s  %8s CHIP  ✓ above threshold — skipping\n" "$a" "$addr" "$human"
    continue
  fi

  need=$((TARGET_UCHIP - bal))
  need_chip=$(echo "scale=2; $need / 1000000" | bc 2>/dev/null || echo "$need")
  printf "   %-10s %-45s  %8s CHIP  → topping up %s CHIP\n" "$a" "$addr" "$human" "$need_chip"

  minitiad tx bank send gas-station "$addr" "${need}uchip" \
    --keyring-backend test --from gas-station \
    --gas auto --gas-adjustment 1.5 --gas-prices "$GAS_PRICES" \
    --node "$NODE" --chain-id "$CHAIN" --yes 2>&1 | grep -E "^txhash:" || true
  sleep 3
done

echo ""
echo -e "${GREEN}── final balances ──${RESET}"
for a in llama qwen mistral nemotron; do
  addr=$(minitiad keys show "$a" --keyring-backend test -a 2>/dev/null) || continue
  bal=$(minitiad query bank balances "$addr" --node "$NODE" --output json 2>/dev/null | jq -r '.balances[] | select(.denom=="uchip") | .amount' || echo "0")
  human=$(echo "scale=2; ${bal:-0} / 1000000" | bc 2>/dev/null || echo "$bal")
  printf "   %-10s %s  %s CHIP\n" "$a" "$addr" "$human"
done
