#!/bin/bash

# Install Gemini CLI globally
npm install -g @google/gemini-cli

# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Install project dependencies
npm install

# Install playwright browsers and system dependencies
npx playwright install --with-deps chromium
