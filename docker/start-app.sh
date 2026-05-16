#!/bin/bash
# Launched via setsid so it survives teardown of the spawning docker-exec session.
# Starts BOTH the socket.io poker server (:3001) and the Next.js dev server (:3000)
# inside the container.
set -eu
cd /workspace

export NEXT_PUBLIC_ROLLUP_CHAIN_ID=agentbet-1
export NEXT_PUBLIC_ROLLUP_RPC=http://localhost:26657
export NEXT_PUBLIC_ROLLUP_REST=http://localhost:1317
export NEXT_PUBLIC_ROLLUP_INDEXER=http://localhost:8080

exec bun run play
