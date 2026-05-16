# Running AgentBet in a GitHub Codespace

No local Docker. No WSL. No CC. 120 free core-hours/month.

## One-time setup

### 1. Push this repo to GitHub

From the agentbet folder:

```bash
gh repo create agentbet --private --source=. --remote=origin --push
```

(Or create a GitHub repo in the UI and `git push` as usual.)

### 2. Open a Codespace

- Go to your repo on github.com
- Click the green **Code** button → **Codespaces** tab → **Create codespace on main**
- A web VS Code loads in ~90 seconds

The devcontainer build runs automatically and installs:

- Ubuntu 22.04 base, Go 1.22, Node 20, Bun
- `weave` v0.3.9, `initiad` v1.4.6, `minitiad` v1.1.11 (Initia toolchain)
- Project dependencies (`bun install`)

When the build finishes, `.devcontainer/post-create.sh` prints the next-step menu.

### 3. First-time rollup bootstrap (one terminal)

```bash
bash .devcontainer/setup-rollup.sh
```

Walks you through `weave init` with the exact answers to paste at each prompt.

Halfway through it will print a gas-station address and pause — **go to
<https://faucet.testnet.initia.xyz>, paste the address, submit**, then come
back and type `continue`. The rest is automated.

> The last step of `weave init` tries to register a systemd service and
> fails inside Codespaces — harmless. The chain is already genesis'd; the
> script then starts `minitiad` manually.

### 4. Fund agents + deploy the Move module

```bash
bash .devcontainer/fund-and-deploy.sh
```

- Creates `llama`/`qwen`/`mistral`/`nemotron` wallets on the rollup
- Funds each with 10,000 CHIP from gas-station
- Builds & deploys `agentbet::game` Move module
- Rewrites `modules/shared/chain.ts` with this Codespace's agent addresses + deployed module address
- Writes `.env.local` with the **public Codespace URLs** for the frontend + **localhost URLs** for the server

### 5. Start the app

```bash
bun run play
```

Runs socket.io (port 3001) and Next.js (port 3000) together.

### 6. Expose ports publicly

In VS Code's lower panel, click the **PORTS** tab. You'll see rows for 3000, 3001, 1317, 8080, 26657.

For each one: **right-click → Port Visibility → Public**.

(Public URLs are how a judge's browser reaches both the frontend AND the rollup REST/indexer.)

### 7. Open the app

Click the globe icon next to port **3000** in the PORTS panel. That opens the forwarded Next.js URL in a new tab. Share that URL to demo.

---

## Starting / stopping / resuming

Codespaces auto-stops after 30 min of inactivity. When you open it again:

- `.devcontainer/post-start.sh` auto-resumes `minitiad` if chain state exists (it does, because `~/.minitia` lives in the Codespace VM disk).
- `bun run play` needs to be re-run manually — open a terminal and paste it.

## If you need to wipe the rollup and start over

```bash
rm -rf ~/.weave ~/.minitia ~/.initia ~/.opinit
pkill minitiad || true
bash .devcontainer/setup-rollup.sh
bash .devcontainer/fund-and-deploy.sh
```

## Troubleshooting

- **Port 3000 won't open / "502 Bad Gateway"**: `bun run play` isn't running yet. Start it in a terminal.
- **Browser can't see CHIP balance / InterwovenKit error**: ports 1317, 8080, 26657 must be **Public** (Port Visibility). Private-forwarded ports are cookie-gated and will fail from the browser.
- **Rollup not producing blocks**: check `tail -f ~/.minitia/node.log`. If it crashed, `nohup minitiad start > ~/.minitia/node.log 2>&1 &`.
- **Move compile hangs**: the `movevm` git dep is ~900MB. First build pre-clones it shallow — should take ~15s. If it stalls, `rm -rf ~/.move && git clone --depth 1 --branch main https://github.com/initia-labs/movevm.git ~/.move/https___github_com_initia-labs_movevm_git_main` then re-run deploy.

## Costs

Each minute of a 4-core Codespace uses 4 core-minutes against your **free 120 core-hours/month**. At that rate you get **30 hours/month** of active runtime. Sessions idle-stop automatically, so just leaving a tab open doesn't burn hours.
