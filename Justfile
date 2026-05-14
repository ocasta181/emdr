set dotenv-load

install:
    pnpm install

dev:
    pnpm run dev

build:
    pnpm run build

check-architecture:
    pnpm check:architecture

check-staged-architecture:
    pnpm check:architecture:staged

electron:
    pnpm run electron

cleanup-run TEST_RUN_ID="" FORCE="":
    run_id="{{TEST_RUN_ID}}"; force="{{FORCE}}"; if [ -n "$run_id" ]; then export TEST_RUN_ID="${run_id#TEST_RUN_ID=}"; fi; if [ -n "$force" ]; then export FORCE="${force#FORCE=}"; fi; node tools/test-run-cleanup.mjs cleanup-run

cleanup-stale-runs STALE_RUN_AGE_HOURS="24" FORCE="":
    age="{{STALE_RUN_AGE_HOURS}}"; force="{{FORCE}}"; if [ -n "$age" ]; then export STALE_RUN_AGE_HOURS="${age#STALE_RUN_AGE_HOURS=}"; fi; if [ -n "$force" ]; then export FORCE="${force#FORCE=}"; fi; node tools/test-run-cleanup.mjs cleanup-stale-runs

status:
    git status --short
