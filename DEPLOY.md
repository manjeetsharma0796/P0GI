# Deploying AgentBet

Two services to deploy:

| Service | Platform | What |
|---------|----------|------|
| Frontend (Next.js) | **Vercel** | The website |
| Game Server (Socket.io + OWS) | **Railway** | Real-time game + wallet signing |

---

## Step 1: Deploy Game Server on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `agentbet` repo
4. Railway will detect `Dockerfile.railway` — let it build
5. Add these **environment variables** in Railway dashboard:

```
NVIDIA_API_KEY=nvapi-xxxxx
NEXT_PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
X402_LIVE=true
OWS_PASSPHRASE=agent-poker-hackathon
PORT=3001
```

6. In **Settings → Networking**, expose port **3001** and enable **Public Networking**
7. Copy the public URL (e.g. `https://agentbet-server-production.up.railway.app`)

> **Note on OWS wallets:** The Railway container won't have the pre-created OWS vault. You'll need to either:
> - Mount a persistent volume at `/root/.ows/vault` and recreate wallets
> - Or set `X402_LIVE=false` for simulated settlements during demo

---

## Step 2: Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Import Project"** → select your `agentbet` repo
3. Vercel auto-detects Next.js — keep defaults
4. Add these **environment variables**:

```
NEXT_PUBLIC_SOCKET_URL=https://your-railway-url.up.railway.app
NEXT_PUBLIC_CHAIN_ID=84532
NEXT_PUBLIC_RPC_URL=https://sepolia.base.org
NVIDIA_API_KEY=nvapi-xxxxx
```

> **Important:** `NEXT_PUBLIC_SOCKET_URL` must point to your Railway game server URL from Step 1.

5. Click **Deploy**

---

## Step 3: Verify

1. Open your Vercel URL
2. Select an agent → should show real USDC balance
3. Go to game → should show "Connected" (green dot)
4. Start game → agents should make decisions

---

## Environment Variables Reference

| Variable | Where | Required | Description |
|----------|-------|----------|-------------|
| `NVIDIA_API_KEY` | Both | Yes | Free from [build.nvidia.com](https://build.nvidia.com) |
| `NEXT_PUBLIC_SOCKET_URL` | Vercel | Yes | Railway game server URL |
| `NEXT_PUBLIC_RPC_URL` | Both | No | Default: Sepolia public RPC |
| `NEXT_PUBLIC_CHAIN_ID` | Vercel | No | Default: 84532 |
| `X402_LIVE` | Railway | No | `true` for real on-chain, `false` for simulated |
| `OWS_PASSPHRASE` | Railway | If X402_LIVE | Vault passphrase |
| `PORT` | Railway | No | Default: 3001 |

---

## Quick Demo Mode

If you just want to show the UI without real on-chain settlements:

1. Deploy both services as above
2. Set `X402_LIVE=false` on Railway
3. The game runs with simulated balances — no Docker/OWS needed
4. AI agents still make real LLM decisions via NVIDIA

This is perfect for a quick hackathon demo where you want to show the flow without waiting for blockchain confirmations.
