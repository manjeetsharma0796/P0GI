# Recovery — "agents show 0 CHIP in the UI"

Three causes. Each has a different fix. Start by identifying which one applies, then follow the matching section.

---

## Step 0 · Triage — figure out which case you're in

In the Codespace terminal:

```bash
# A. Is the rollup running?
curl -s http://localhost:26657/status | grep -oE '"latest_block_height":"[0-9]+"' | head -1

# B. Do the agent keys still exist?
minitiad keys list --keyring-backend test | grep -E "^- name:" | awk '{print $3}'

# C. What do they currently hold on-chain?
for a in llama qwen mistral nemotron; do
  addr=$(minitiad keys show "$a" --keyring-backend test -a 2>/dev/null) || { echo "$a: missing"; continue; }
  bal=$(minitiad query bank balances "$addr" --node http://localhost:26657 --output json | jq -r '.balances[] | select(.denom=="uchip") | .amount')
  echo "$a  $addr  ${bal:-0} uchip"
done
```

Interpretation:

| A · block height | B · keys listed | C · balances | Go to |
|---|---|---|---|
| no output / connection refused | — | — | **Case 1** |
| growing | missing `llama/qwen/mistral/nemotron` | n/a | **Case 3** |
| growing | present | all show 0 or low | **Case 2** |
| growing | present | all show real amounts | UI bug, not chain — see **Step Z** |

---

## Case 1 · Rollup isn't running

The `minitiad` process died or the Codespace restarted without auto-resume.

```bash
# Start it in the background
nohup minitiad start > ~/.minitia/node.log 2>&1 &
disown

# Wait 10s and verify
sleep 10
curl -s http://localhost:26657/status | grep latest_block_height
```

Expect a growing block height. Agent balances are preserved in chain state — they weren't lost, they just couldn't be queried while the chain was off.

If `minitiad` fails to start, look at the log: `tail -40 ~/.minitia/node.log`.

---

## Case 2 · Agents have real 0 balances (lost it all, or never funded)

Single command refill — safe, idempotent. Reads each agent's current balance, tops any wallet below **1,000 CHIP** back to **10,000 CHIP** from gas-station.

```bash
bash .devcontainer/refund-agents.sh
```

Output example:

```
gas-station balance: 9999999.95 CHIP

   llama      init1vfr6...mvyyhn    0.00 CHIP  → topping up 10000 CHIP
   qwen       init1ljg3...24pf      10000.00 CHIP  ✓ above threshold — skipping
   mistral    init14zuw...h6gjv     500.12 CHIP  → topping up 9499.88 CHIP
   nemotron   init124qa...s38dw     0.00 CHIP  → topping up 10000 CHIP
```

Refresh the browser. Agent cards show the new balances within ~5 seconds (wallet panel polls every 5s).

---

## Case 3 · Agent keys are missing (fresh Codespace, or keyring wiped)

The rollup exists but the wallets themselves aren't in the keyring. Run the full fund-and-deploy which creates keys + funds them + redeploys the Move module:

```bash
bash .devcontainer/fund-and-deploy.sh
```

~2 minutes. At the end, `modules/shared/chain.ts` + `.env.local` are rewritten with the new addresses. Restart the app so the frontend picks up the new values:

```bash
pkill -f "bun run play" || true
pkill -f "next dev" || true
pkill -f "bun run server" || true
bun run play
```

Refresh the browser.

---

## Case 4 · Completely fresh Codespace (even the rollup is gone)

Rare — only after a full Codespace recreation where `~/.minitia` was wiped.

```bash
bash .devcontainer/setup-rollup.sh    # interactive weave init; ~3 min
bash .devcontainer/fund-and-deploy.sh # ~2 min
bun run play
```

Then make ports 3000, 3001, 1317, 8080, 26657 **Public** in the PORTS tab.

---

## Step Z · Chain has real balances but the UI shows 0

This means `modules/shared/chain.ts` has **stale addresses** that don't match the current rollup's keys. Happens if you pulled fresh code but never re-ran `fund-and-deploy.sh` on this Codespace.

Fix:

```bash
bash .devcontainer/fund-and-deploy.sh
# then
pkill -f "bun run play" || true ; bun run play
```

The `fund-and-deploy` script regenerates `modules/shared/chain.ts` with the keys present in your keyring, so the frontend starts reading the right addresses.

---

## Quick reference

| Command | When to use |
|---|---|
| `bash .devcontainer/refund-agents.sh` | Anyone is below 1,000 CHIP — most common fix |
| `bash .devcontainer/fund-and-deploy.sh` | Agent keys don't exist, or chain.ts out of sync |
| `bash .devcontainer/setup-rollup.sh` | Rollup state is missing entirely (fresh Codespace) |
| `bash .devcontainer/post-start.sh` | Just bring everything back up after sleep |
| `nohup minitiad start > ~/.minitia/node.log 2>&1 &` | Manually start the rollup if it died |
