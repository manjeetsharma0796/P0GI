FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Etc/UTC \
    GOPATH=/home/vscode/go \
    PATH=/usr/local/go/bin:/home/vscode/go/bin:/home/vscode/.bun/bin:/usr/local/bin:/usr/bin:/bin

# Tooling
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl wget git unzip jq bc lz4 \
        build-essential pkg-config libssl-dev \
        lsb-release vim less \
    && rm -rf /var/lib/apt/lists/*

# Go 1.22 (needed if we ever compile from source; Initia binaries are pre-built below)
ARG GO_VERSION=1.22.10
RUN ARCH=$(dpkg --print-architecture) \
    && case "$ARCH" in \
         amd64) GO_ARCH=amd64 ;; \
         arm64) GO_ARCH=arm64 ;; \
         *) echo "unsupported arch $ARCH" && exit 1 ;; \
       esac \
    && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GO_ARCH}.tar.gz" -o /tmp/go.tgz \
    && tar -C /usr/local -xzf /tmp/go.tgz \
    && rm /tmp/go.tgz

# Node.js 20 (via nodesource)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@latest

# Initia toolchain — baked in so Codespaces rebuilds don't re-download every time.
ARG WEAVE_VERSION=0.3.9
ARG INITIA_VERSION=1.4.6
ARG MINIMOVE_VERSION=1.1.11
RUN set -eux; \
    TMP=$(mktemp -d); cd "$TMP"; \
    curl -fsSL "https://github.com/initia-labs/weave/releases/download/v${WEAVE_VERSION}/weave-${WEAVE_VERSION}-linux-amd64.tar.gz" | tar -xz; \
    install -m 0755 weave /usr/local/bin/weave; \
    curl -fsSL "https://github.com/initia-labs/initia/releases/download/v${INITIA_VERSION}/initia_v${INITIA_VERSION}_Linux_x86_64.tar.gz" | tar -xz; \
    install -m 0755 initiad /usr/local/bin/initiad; \
    install -m 0644 libmovevm.x86_64.so /usr/lib/x86_64-linux-gnu/libmovevm.x86_64.so; \
    install -m 0644 libcompiler.x86_64.so /usr/lib/x86_64-linux-gnu/libcompiler.x86_64.so; \
    curl -fsSL "https://github.com/initia-labs/minimove/releases/download/v${MINIMOVE_VERSION}/minimove_v${MINIMOVE_VERSION}_Linux_x86_64.tar.gz" | tar -xz; \
    install -m 0755 minitiad /usr/local/bin/minitiad; \
    rm -rf "$TMP"; \
    weave version; initiad version; minitiad version

# Bun (installed as the vscode user, not root)
USER vscode
RUN curl -fsSL https://bun.sh/install | bash \
    && echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc

USER root

# Git-safety so mounted workspaces don't trip "dubious ownership"
RUN git config --system --add safe.directory '*'

# Friendly prompt
RUN echo 'PS1="\[\e[38;5;39m\]agentbet\[\e[0m\]:\[\e[38;5;214m\]\w\[\e[0m\]\$ "' >> /home/vscode/.bashrc

USER vscode
WORKDIR /workspaces
