#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Agent Poker — Full Docker + Env Setup for New Teammates
#
# This script sets up EVERYTHING a new team member needs:
#   1. Docker image with OWS CLI
#   2. Pre-loaded encrypted wallets (same addresses, same funds)
#   3. .env.local with all required keys
#
# Run: bash scripts/docker-setup-with-env.sh
# ─────────────────────────────────────────────────────────────

set -e

CONTAINER="ows-agent-poker"
IMAGE="ows-poker"
EXPORT_DIR="docker/export"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   Agent Poker — Docker + Env Setup               ║"
echo "║   For new team members (J, M, P)                 ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Check Docker ─────────────────────────────────────
echo "[1/7] Checking Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Start Docker Desktop first."
  exit 1
fi
echo "  ✅ Docker running"

# ── Step 2: Load pre-built image ─────────────────────────────
echo ""
echo "[2/7] Loading OWS Docker image..."
if docker images | grep -q "$IMAGE"; then
  echo "  ✅ Image already exists"
else
  if [ -f "$EXPORT_DIR/ows-poker-image.tar.gz" ]; then
    docker load < "$EXPORT_DIR/ows-poker-image.tar.gz"
    echo "  ✅ Image loaded from export"
  else
    echo "  ⚠ No exported image found. Building from Dockerfile..."
    docker build -f docker/Dockerfile.ows -t "$IMAGE" docker/
    echo "  ✅ Image built"
  fi
fi

# ── Step 3: Start container ──────────────────────────────────
echo ""
echo "[3/7] Starting container..."
if docker ps | grep -q "$CONTAINER"; then
  echo "  ✅ Container already running"
elif docker ps -a | grep -q "$CONTAINER"; then
  docker start "$CONTAINER"
  echo "  ✅ Container restarted"
else
  docker run -d --name "$CONTAINER" "$IMAGE"
  echo "  ✅ Container created"
fi

# ── Step 4: Load wallet vault ────────────────────────────────
echo ""
echo "[4/7] Loading encrypted wallet vault..."
if [ -d "$EXPORT_DIR/ows-vault" ]; then
  # Copy vault into container
  docker exec "$CONTAINER" rm -rf /root/.ows/wallets /root/.ows/policies /root/.ows/logs 2>/dev/null || true
  docker cp "$EXPORT_DIR/ows-vault/wallets" "$CONTAINER:/root/.ows/"
  docker cp "$EXPORT_DIR/ows-vault/policies" "$CONTAINER:/root/.ows/" 2>/dev/null || true
  docker cp "$EXPORT_DIR/ows-vault/logs" "$CONTAINER:/root/.ows/" 2>/dev/null || true
  echo "  ✅ Vault loaded (5 encrypted wallets)"
else
  echo "  ⚠ No vault export found. Creating fresh wallets..."
  for W in poker-llama poker-mistral poker-deepseek poker-qwen poker-pot; do
    docker exec "$CONTAINER" ows wallet create --name "$W" 2>/dev/null || true
  done
  echo "  ✅ Fresh wallets created (NOTE: different addresses — need new funding)"
fi

# ── Step 5: Verify wallets ───────────────────────────────────
echo ""
echo "[5/7] Verifying wallets..."
WALLET_COUNT=$(docker exec "$CONTAINER" ows wallet list 2>&1 | grep -c "poker-" || echo "0")
echo "  ✅ $WALLET_COUNT poker wallets found"

# ── Step 6: Create .env.local ────────────────────────────────
echo ""
echo "[6/7] Setting up .env.local..."
if [ -f ".env.local" ]; then
  echo "  ⚠ .env.local already exists — skipping (won't overwrite)"
  echo "  Check it has these keys:"
  echo "    NVIDIA_API_KEY=nvapi-..."
  echo "    X402_LIVE=true"
else
  cat > .env.local << 'ENVEOF'
# Agent Poker Environment Variables
# Get your NVIDIA API key at: https://build.nvidia.com

NVIDIA_API_KEY=              # ← FILL THIS IN from build.nvidia.com
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
X402_LIVE=true
ENVEOF
  echo "  ✅ .env.local created"
  echo "  ⚠ You MUST add your NVIDIA_API_KEY before playing!"
fi

# ── Step 7: Show summary ────────────────────────────────────
echo ""
echo "[7/7] Setup Complete!"
echo ""
echo "─────────────────────────────────────────────────"
echo "  OWS Wallets (Ethereum Sepolia):"
echo "─────────────────────────────────────────────────"
echo ""

docker exec "$CONTAINER" ows wallet list 2>&1 | grep -E "Name:|eip155" | while read line; do
  if echo "$line" | grep -q "Name:"; then
    NAME=$(echo "$line" | awk '{print $2}')
    printf "  %-18s" "$NAME"
  fi
  if echo "$line" | grep -q "eip155"; then
    ADDR=$(echo "$line" | grep -o '0x[a-fA-F0-9]*')
    echo "→ $ADDR"
  fi
done

echo ""
echo "─────────────────────────────────────────────────"
echo ""
echo "  Funded balances (check on Etherscan):"
echo "  https://sepolia.etherscan.io/address/<address>"
echo ""
echo "─────────────────────────────────────────────────"
echo ""
echo "  📋 NEXT STEPS:"
echo ""
echo "  1. Add your NVIDIA API key to .env.local:"
echo "     Get one free at: https://build.nvidia.com"
echo ""
echo "  2. Install dependencies:"
echo "     bun install"
echo ""
echo "  3. Start the game:"
echo "     Terminal 1: bun run server"
echo "     Terminal 2: bun run dev"
echo "     Browser:    http://localhost:3000/game/1"
echo ""
echo "  4. Check logs after playing:"
echo "     cat data/transactions.log    # settlement txs"
echo "     cat data/game.log            # full game log"
echo ""
echo "  5. Verify Docker OWS:"
echo "     docker exec $CONTAINER ows wallet list"
echo "     docker exec $CONTAINER ows --version"
echo ""
echo "  📄 Read FLOW.md for full architecture overview"
echo "  📄 Read RUN.md for detailed run instructions"
echo ""
