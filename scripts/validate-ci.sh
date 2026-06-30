#!/bin/bash

# CI Validation Script
# Runs all CI checks locally to catch issues before pushing to GitHub
# This mirrors the GitHub Actions CI workflow

set -e  # Exit on any error

echo "🚀 Starting CI Validation..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if we're in Docker or not
if [ -f /.dockerenv ]; then
    IN_DOCKER=true
else
    IN_DOCKER=false
fi

# Clean up .next directory before starting to avoid permission issues
if [ "$IN_DOCKER" = false ]; then
    echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
    docker compose exec -T rescuedogs rm -rf .next 2>/dev/null || true
fi

# Function to run a check
run_check() {
    local name=$1
    local command=$2

    echo -e "\n${YELLOW}🔍 Running: ${name}${NC}"
    echo "--------------------------------"

    if [ "$IN_DOCKER" = true ]; then
        # Running inside Docker, execute directly
        if $command; then
            echo -e "${GREEN}✅ ${name} passed${NC}"
        else
            echo -e "${RED}❌ ${name} failed${NC}"
            exit 1
        fi
    else
        # Running outside Docker, use docker compose exec
        if docker compose exec -T rescuedogs $command; then
            echo -e "${GREEN}✅ ${name} passed${NC}"
        else
            echo -e "${RED}❌ ${name} failed${NC}"
            exit 1
        fi
    fi
}

# 1. Lint check
run_check "ESLint" "pnpm lint"

# 2. Type check
run_check "TypeScript type check" "pnpm type-check"

# 3. Unit tests
# --no-file-parallelism: run test files serially. On Windows/Docker hosts the
# parallel pool leaks async module loads past environment teardown, producing
# non-deterministic "caught after teardown" errors that fail the run even
# though every assertion passes. CI (clean Linux runners) does not hit this and
# keeps the default parallel `pnpm test --run`.
run_check "Unit tests" "pnpm test --run --no-file-parallelism"

# 4. Test coverage (optional - can be slow)
if [ "$1" != "--quick" ]; then
    run_check "Test coverage" "pnpm test:coverage"
fi

# 5. Production build (full validation only — skipped by --quick / pre-push)
# The production build is unreliable on Windows/Docker bind-mount hosts: Next's
# "Collecting page data" step intermittently fails with spurious "Cannot find
# module for page" errors because the bind mount has not flushed freshly-emitted
# chunks. The same build is green on CI's native Linux runners (ci.yml +
# deploy.yml), so CI is the authoritative build gate. We therefore keep the fast
# reliable checks (lint, type-check, unit tests) in the pre-push --quick path and
# defer the build here. NEXT_DIST_DIR keeps it off the running dev server's .next.
if [ "$1" != "--quick" ]; then
    echo -e "\n${YELLOW}🔍 Running: Production build${NC}"
    echo "--------------------------------"
    if [ "$IN_DOCKER" = true ]; then
        if NEXT_DIST_DIR=.next-ci pnpm build; then
            echo -e "${GREEN}✅ Production build passed${NC}"
        else
            echo -e "${RED}❌ Production build failed${NC}"
            exit 1
        fi
    else
        if docker compose exec -T -e NEXT_DIST_DIR=.next-ci rescuedogs pnpm build; then
            echo -e "${GREEN}✅ Production build passed${NC}"
        else
            echo -e "${RED}❌ Production build failed${NC}"
            exit 1
        fi
    fi
fi

# 6. Storybook build (optional - can be slow)
if [ "$1" != "--quick" ]; then
    run_check "Storybook build" "pnpm build-storybook"
fi

echo -e "\n================================"
echo -e "${GREEN}🎉 All CI checks passed!${NC}"
echo -e "Safe to push to GitHub.\n"