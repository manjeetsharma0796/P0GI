#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Agent Poker — OWS Docker Setup (first-time only)
# Run: bash scripts/setup-docker-ows.sh
# ─────────────────────────────────────────────────────────────

set -e

CONTAINER="ows-agent-poker"
IMAGE="ows-poker"
DOCKERFILE="docker/Dockerfile.ows"
PASSPHRASE="agent-poker-hackathon"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   Agent Poker — OWS Docker Setup             ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Check Docker is running ──────────────────────────
echo "[1/6] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Start Docker Desktop first."
  exit 1
fi
echo "  ✅ Docker is running"

# ── Step 2: Build OWS image ─────────────────────────────────
echo ""
echo "[2/6] Building OWS Docker image..."
if docker images | grep -q "$IMAGE"; then
  echo "  ✅ Image '$IMAGE' already exists (use --rebuild to force)"
else
  docker build -f "$DOCKERFILE" -t "$IMAGE" docker/
  echo "  ✅ Image built"
fi

# ── Step 3: Start container ──────────────────────────────────
echo ""
echo "[3/6] Starting OWS container..."
if docker ps | grep -q "$CONTAINER"; then
  echo "  ✅ Container '$CONTAINER' already running"
elif docker ps -a | grep -q "$CONTAINER"; then
  docker start "$CONTAINER"
  echo "  ✅ Container restarted"
else
  docker run -d --name "$CONTAINER" "$IMAGE"
  echo "  ✅ Container created and started"
fi

# ── Step 4: Verify OWS CLI works ────────────────────────────
echo ""
echo "[4/6] Verifying OWS CLI..."
OWS_VERSION=$(docker exec "$CONTAINER" ows --version 2>&1)
echo "  ✅ $OWS_VERSION"

# ── Step 5: Create poker wallets ─────────────────────────────
echo ""
echo "[5/6] Creating OWS wallets..."

WALLETS=("poker-llama" "poker-mistral" "poker-deepseek" "poker-qwen" "poker-pot")

for WALLET in "${WALLETS[@]}"; do
  EXISTING=$(docker exec "$CONTAINER" ows wallet list 2>&1 | grep "$WALLET" || true)
  if [ -n "$EXISTING" ]; then
    echo "  ✅ $WALLET (already exists)"
  else
    docker exec "$CONTAINER" ows wallet create --name "$WALLET" 2>&1 | head -2
    echo "  ✅ $WALLET (created)"
  fi
done

# ── Step 6: Show all wallet addresses ────────────────────────
echo ""
echo "[6/6] Wallet Summary"
echo "─────────────────────────────────────────────"
echo ""

for WALLET in "${WALLETS[@]}"; do
  EVM_ADDR=$(docker exec "$CONTAINER" ows wallet list 2>&1 | grep -A 1 "$WALLET" | grep "eip155" | grep -o '0x[a-fA-F0-9]*' | head -1)
  if [ -n "$EVM_ADDR" ]; then
    echo "  $WALLET → $EVM_ADDR"
  fi
done

echo ""
echo "─────────────────────────────────────────────"
echo ""
echo "✅ OWS Docker setup complete!"
echo ""
echo "Next steps:"
echo "  1. Fund wallets with Sepolia ETH + USDC"
echo "     Faucet: https://www.alchemy.com/faucets/ethereum-sepolia"
echo ""
echo "  2. Set X402_LIVE=true in .env.local for real settlements"
echo ""
echo "  3. Start the game:"
echo "     Terminal 1: bun run server"
echo "     Terminal 2: bun run dev"
echo "     Browser:    http://localhost:3000/game/1"
echo ""
echo "  4. Check OWS manually:"
echo "     docker exec $CONTAINER ows wallet list"
echo "     docker exec $CONTAINER ows --version"
echo ""
echo "  5. View logs after a game:"
echo "     cat data/transactions.log"
echo "     cat data/game.log"
echo ""
