# syntax=docker/dockerfile:1
FROM node:22-bookworm AS builder

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

RUN npm install && npm run build

FROM node:22-bookworm-slim

WORKDIR /app

ARG UID=1000
ARG GID=1000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY entrypoint.sh /

ENTRYPOINT [ "/entrypoint.sh" ]

RUN if getent passwd $UID; then deluser $(getent passwd $UID | cut -d: -f1); fi && \
    if getent group $GID; then delgroup $(getent group $GID | cut -d: -f1); fi && \
    groupadd -g $GID appuser && \
    useradd -u $UID -g $GID -m appuser && \
    npm install --production && \
    npx playwright install --with-deps chromium

USER appuser
