#!/usr/bin/env bash
set -e
if [ -f package.json ]; then
  npm run lint || true
  npm test || true
fi
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  pytest || true
fi
