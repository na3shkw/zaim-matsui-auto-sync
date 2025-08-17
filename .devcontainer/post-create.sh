#!/bin/bash

# Install Gemini CLI globally
npm install -g @google/gemini-cli

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Install project dependencies
npm install

# Install playwright browsers and system dependencies
npx playwright install --with-deps chromium

# Install uv
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/astral-sh/uv/releases/download/0.8.11/uv-installer.sh | sh

# Add serena MCP to Claude Code
# https://github.com/oraios/serena/tree/a597bb1715b43ac19fae142c61c23b7ff6576232?tab=readme-ov-file#claude-code
claude mcp add serena -- uvx --from git+https://github.com/oraios/serena serena start-mcp-server --context ide-assistant --project $(pwd)
