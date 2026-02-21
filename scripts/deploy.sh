#!/bin/bash
# Auto-deploy script for sidehustle-engine
# Validates build, commits, pushes to main → triggers Railway + Vercel auto-deploy
#
# Usage:
#   ./scripts/deploy.sh "commit message"
#   ./scripts/deploy.sh                   # auto-generates commit message from git diff

set -euo pipefail
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "\n${BOLD}🚀 Deploy Pipeline${NC}\n"

# 1. Check for changes
if git diff --quiet && git diff --cached --quiet; then
  echo -e "${YELLOW}No changes to deploy.${NC}"
  exit 0
fi

# 2. Validate client build
echo -e "${BOLD}[1/5] Building client...${NC}"
cd client
npm run build 2>&1 | tail -3
cd ..
echo -e "${GREEN}  ✓ Client build passed${NC}"

# 3. Syntax check server (basic import test)
echo -e "${BOLD}[2/5] Checking server syntax...${NC}"
node --check server/index.js 2>&1 || { echo -e "${RED}  ✗ Server syntax error${NC}"; exit 1; }
echo -e "${GREEN}  ✓ Server syntax OK${NC}"

# 4. Stage and commit
echo -e "${BOLD}[3/5] Committing...${NC}"
git add -A
MSG="${1:-$(git diff --cached --stat | tail -1 | sed 's/^ *//')}"
git commit -m "$MSG" || { echo -e "${YELLOW}  Nothing to commit${NC}"; }
echo -e "${GREEN}  ✓ Committed${NC}"

# 5. Push
echo -e "${BOLD}[4/5] Pushing to origin/main...${NC}"
git push origin main
echo -e "${GREEN}  ✓ Pushed — Railway + Vercel will auto-deploy${NC}"

# 6. Wait for deploy and run protocol tests
echo -e "${BOLD}[5/5] Waiting 60s for deploy, then running tests...${NC}"
sleep 60
node scripts/test-voice-protocol.mjs --prod 2>&1 || echo -e "${YELLOW}  ⚠ Some tests failed (check output above)${NC}"

echo -e "\n${GREEN}${BOLD}Deploy complete.${NC}\n"
