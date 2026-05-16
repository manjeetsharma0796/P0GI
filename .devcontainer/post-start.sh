#!/usr/bin/env bash
# Runs every time the Codespace starts (incl. after sleep).
# Auto-resumes both the rollup node AND the app so the user lands
# in a fully-live environment without re-running setup.
set -eu

cd "$(dirname "$0")/.."

echo ""
echo "── agentbet · post-start ──"

# ── rollup node ──
if [ ! -f "$HOME/.minitia/config/genesis.json" ]; then
  echo "[post-start] no rollup state — run 'bash .devcontainer/setup-rollup.sh' to create it."
else
  if pgrep -x minitiad >/dev/null; then
    echo "[post-start] minitiad already running (pid $(pgrep -x minitiad))"
  else
    echo "[post-start] resuming rollup node…"
    nohup minitiad start > "$HOME/.minitia/node.log" 2>&1 < /dev/null &
    disown || true

    # wait for RPC before launching the app
    for _ in $(seq 1 30); do
      if curl -s --max-time 2 http://localhost:26657/status 2>/dev/null | grep -q "latest_block_height"; then
        break
      fi
      sleep 2
    done
    height=$(curl -s http://localhost:26657/status 2>/dev/null | jq -r '.result.sync_info.latest_block_height' 2>/dev/null || echo "?")
    echo "[post-start] rollup resumed  height=$height  chain=agentbet-1"
  fi
fi

# ── next.js + socket.io ──
if ! [ -f "$(pwd)/.env.local" ]; then
  echo "[post-start] no .env.local yet — run 'bash .devcontainer/fund-and-deploy.sh' first."
  exit 0
fi

if pgrep -f "bun run play" >/dev/null || pgrep -f "next dev" >/dev/null; then
  echo "[post-start] bun run play already running"
else
  echo "[post-start] starting bun run play (Next.js :3000 + socket.io :3001)…"
  nohup bash -lc 'cd /workspaces/agent1 && bun run play' > "$HOME/play.log" 2>&1 < /dev/null &
  disown || true
  sleep 2
  echo "[post-start] bun launched — logs at ~/play.log"
fi

echo ""
echo "── ready ──"
echo "   rollup     http://localhost:26657 · :1317"
echo "   next.js    http://localhost:3000"
echo "   socket.io  http://localhost:3001"
echo "   logs       tail -F ~/.minitia/node.log  |  tail -F ~/play.log"
echo ""
