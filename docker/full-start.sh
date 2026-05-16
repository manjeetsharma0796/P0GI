#!/bin/bash
# Container entrypoint. Starts BOTH the rollup node AND the Next.js+socket.io
# app. This is PID 1 — if it dies the container exits and Docker restarts it.
set -u

export NEXT_PUBLIC_ROLLUP_CHAIN_ID=${NEXT_PUBLIC_ROLLUP_CHAIN_ID:-agentbet-1}
export NEXT_PUBLIC_ROLLUP_RPC=${NEXT_PUBLIC_ROLLUP_RPC:-http://localhost:26657}
export NEXT_PUBLIC_ROLLUP_REST=${NEXT_PUBLIC_ROLLUP_REST:-http://localhost:1317}
export NEXT_PUBLIC_ROLLUP_INDEXER=${NEXT_PUBLIC_ROLLUP_INDEXER:-http://localhost:8080}

echo "[full-start] booting rollup..."
minitiad start > /root/.minitia/node.log 2>&1 &
ROLLUP_PID=$!

# wait up to 60s for RPC to answer
for i in $(seq 1 30); do
  if curl -s --max-time 2 http://localhost:26657/status 2>/dev/null | grep -q "latest_block_height"; then
    echo "[full-start] rollup RPC answering (pid=$ROLLUP_PID)"
    break
  fi
  sleep 2
done

echo "[full-start] booting app (bun run play)..."
cd /workspace
bun run play > /root/play.log 2>&1 &
APP_PID=$!

echo "[full-start] ready. rollup=$ROLLUP_PID  app=$APP_PID"
echo "[full-start] tailing logs; container keeps running"

# Follow both logs so `docker logs agentbet-dev` shows everything
tail -F /root/.minitia/node.log /root/play.log 2>/dev/null &
TAIL_PID=$!

# Clean shutdown on SIGTERM
trap "kill $ROLLUP_PID $APP_PID $TAIL_PID 2>/dev/null; exit 0" TERM INT

# Keep PID 1 alive. If rollup or app dies we want to stay up so logs are
# visible; Docker restart policy handles container death.
wait $TAIL_PID
