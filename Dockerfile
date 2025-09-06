# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS dev-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts

FROM node:22-bookworm-slim AS prod-dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production --ignore-scripts

FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY --from=dev-dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

ARG UID=1000
ARG GID=1000

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

RUN if getent passwd $UID; then deluser $(getent passwd $UID | cut -d: -f1); fi && \
    if getent group $GID; then delgroup $(getent group $GID | cut -d: -f1); fi && \
    groupadd -g $GID appuser && \
    useradd -u $UID -g $GID -m appuser && \
    mkdir -p /etc/sudoers.d && \
    echo 'appuser ALL=(ALL) NOPASSWD: ALL' >> /etc/sudoers.d/appuser && \
    chmod 0440 /etc/sudoers.d/appuser

COPY --from=prod-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

USER appuser

RUN sudo chown -R appuser:appuser . && \
    sudo chown -R appuser:appuser /home/appuser && \
    npx playwright install --with-deps chromium

COPY --chmod=755 entrypoint.sh /

ENTRYPOINT [ "/entrypoint.sh" ]
