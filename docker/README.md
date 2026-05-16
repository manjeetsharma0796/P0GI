# agentbet dev container

Linux dev environment for the Initia hackathon port. Ubuntu 22.04 + Go 1.22 + Node 20 + Bun + Docker CLI. The host Docker socket is mounted so `weave` can spawn sibling containers (OPinit executor, IBC relayer) on your host's Docker Desktop.

## Prerequisites (on Windows host)

- Docker Desktop running, WSL2 backend enabled

## First-time build

```bash
cd docker
docker compose build
```

Expect ~3–5 minutes.

## Start and enter the container

```bash
docker compose up -d
docker compose exec agentbet-dev bash
```

You land in `/workspace` which is a live bind-mount of the project root. Edit files from Windows in your IDE, run them inside Linux.

## Useful commands inside the container

```bash
go version          # Go 1.22.x
node --version      # v20.x
bun --version
docker ps           # Talks to host Docker Desktop

# Install Initia toolchain (run this inside the container once, after build)
# See docs/hackathon/get-started — weave / initiad / minitiad install
```

## Ports

| Host      | Container | Service                       |
|-----------|-----------|-------------------------------|
| 3000      | 3000      | Next.js frontend              |
| 3001      | 3001      | Bun socket.io server          |
| 3005      | 3005      | OPinit executor (custom)      |
| 26657     | 26657     | Rollup RPC                    |
| 1317      | 1317      | Rollup REST                   |
| 8080      | 8080      | Rollup indexer (block explorer UI) |

> `weave opinit init executor` defaults to `localhost:3000` — override to `localhost:3005` to avoid colliding with the Next.js dev server.

## Volumes

- `agentbet-home` — persists `/root` (weave config, keyrings, bash history). Do NOT delete without reason.
- `agentbet-gocache` — Go module cache; speeds up repeat builds.
- `agentbet-node-modules` — isolates Linux `node_modules` from the Windows source tree (avoids native-module conflicts).

## Rebuild from scratch

```bash
docker compose down -v   # WARNING: wipes keyrings, rollup state, deps
docker compose build --no-cache
docker compose up -d
```
