#!/bin/bash

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Install project dependencies
npm install

# Install playwright browsers and system dependencies
npx playwright install --with-deps --no-shell chromium
