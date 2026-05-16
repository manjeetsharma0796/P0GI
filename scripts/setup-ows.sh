#!/bin/bash
# Setup OWS wallets, policies, and API keys for all agents
# Run via: echo 'bash /mnt/c/workspace/claude-adding-skill/poker-night-ai/scripts/setup-ows.sh' | wsl

OWS="/home/manjeet0796/.ows/bin/ows"

echo "=== OWS Agent Poker Setup ==="
echo ""

# Create 4 agent wallets + 1 pot wallet
for NAME in poker-llama poker-mistral poker-deepseek poker-qwen poker-pot; do
  echo "--- Creating wallet: $NAME ---"
  $OWS wallet create --name "$NAME" 2>/dev/null || echo "(already exists)"
  $OWS wallet info --name "$NAME" 2>/dev/null | head -5
  echo ""
done

# Create policies
echo "=== Creating Policies ==="

# Sepolia-only chain policy
$OWS policy create --json '{
  "id": "sepolia-only",
  "name": "Ethereum Sepolia Only",
  "rules": [{"type": "chain_allowlist", "chains": ["eip155:11155111"]}]
}' 2>/dev/null || echo "(policy exists)"

# Agent spending limit policy
$OWS policy create --json '{
  "id": "poker-spend-limit",
  "name": "Poker Agent Spend Limit",
  "rules": [
    {"type": "chain_allowlist", "chains": ["eip155:11155111"]},
    {"type": "spending_limit", "max_per_transaction": 10, "max_daily": 100, "token": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"}
  ]
}' 2>/dev/null || echo "(policy exists)"

echo ""
echo "=== Listing All Wallets ==="
$OWS wallet list 2>/dev/null

echo ""
echo "=== Listing All Policies ==="
$OWS policy list 2>/dev/null

echo ""
echo "=== Creating API Keys ==="
for NAME in poker-llama poker-mistral poker-deepseek poker-qwen; do
  WALLET_ID=$($OWS wallet info --name "$NAME" 2>/dev/null | grep -o 'id: [^ ]*' | head -1 | cut -d' ' -f2)
  if [ -n "$WALLET_ID" ]; then
    echo "Creating API key for $NAME (wallet: $WALLET_ID)..."
    $OWS key create --name "${NAME}-key" --wallets "$WALLET_ID" --policies "poker-spend-limit" --passphrase "agent-poker-hackathon" 2>/dev/null || echo "(key exists)"
  fi
done

echo ""
echo "=== Setup Complete ==="
$OWS wallet list 2>/dev/null
