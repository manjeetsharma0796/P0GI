#!/usr/bin/env bash
# Runs ONCE after a Codespace is created. Installs project deps + verifies
# the Initia toolchain is reachable. Does NOT touch chain state — that's
# set up in setup-rollup.sh so the user has full visibility into the keys.
set -eu

cd "$(dirname "$0")/.."

echo ""
echo "── agentbet Codespace · post-create ─────────────────────────────────"
echo ""

echo "[1/3] tool check"
weave version
initiad version
minitiad version
node --version
bun --version || { echo "bun missing"; exit 1; }

echo ""
echo "[2/3] installing project dependencies (bun install)"
bun install

echo ""
echo "[3/3] ready"
cat <<'EOF'

   Next steps (paste one at a time in the terminal):

     bash .devcontainer/setup-rollup.sh     # first time only — spins up agentbet-1
     bash .devcontainer/fund-and-deploy.sh  # funds agents + deploys Move module
     bun run play                            # starts Next.js :3000 + socket.io :3001

   Then click the "PORTS" tab in VS Code, right-click port 3000
   → "Port Visibility: Public" → open the forwarded URL in a browser.

EOF
