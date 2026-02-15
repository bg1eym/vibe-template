#!/usr/bin/env bash
set -e
if [ -f package.json ]; then
  npm test
  exit 0
fi
if [ -f pyproject.toml ] || [ -f requirements.txt ]; then
  pytest
  exit 0
fi
exit 1
