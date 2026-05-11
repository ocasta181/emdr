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

status:
    git status --short
