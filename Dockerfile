# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

RUN npm ci --include=dev --ignore-scripts && \
    npm run build

FROM node:22-bookworm-slim

WORKDIR /app

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get --no-install-recommends install -y \
        sudo \
        lxde \
        tigervnc-standalone-server \
        tigervnc-common \
        dbus-x11

RUN mkdir -p /etc/sudoers.d && \
    echo 'node ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers.d/node && \
    chmod 0440 /etc/sudoers.d/node && \
    chown -R node:node .

USER node

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/package*.json ./

RUN npm ci --omit=dev --ignore-scripts && \
    npx playwright install --with-deps --no-shell chromium && \
    npm cache clean --force && \
    sudo npm uninstall -g npm && \
    sudo find /usr/local/bin -type l -name "yarn*" -exec unlink {} \; && \
    sudo rm -rf \
        /opt/yarn-* \
        /tmp/* \
        /home/node/.cache/ms-playwright/ffmpeg* \
        /home/node/.npm/_logs/*

COPY --chmod=755 entrypoint.sh /

ENTRYPOINT [ "/entrypoint.sh" ]
