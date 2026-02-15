# Onboarding

## Install

npm install

## Build

npm run build

## Test

npm test

## Run dev

npm run dev

Recommended (dev + /health self-check):
./scripts/dev.sh

## Verify locally

./scripts/check-all.sh

## API

- GET /health
- Items CRUD + pagination under /items

## Auth (placeholder)

Recommended:

- Authorization: Bearer user\_<USER_ID>

## Common issues

### Port already in use

lsof -i :3000
kill <PID>

Or run on a different port:
PORT=3001 npm run dev
