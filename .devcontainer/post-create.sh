#!/bin/bash

# Install Gemini CLI globally
npm install -g @google/gemini-cli

# Install project dependencies
npm install

# Install playwright browsers and system dependencies
npx playwright install --with-deps chromium
