#!/usr/bin/env bash
set -euo pipefail

npm run build
npm test
npm run fmt:check
npm run lint
npm audit

echo OK
