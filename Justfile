set dotenv-load

install:
    pnpm install

dev:
    pnpm run dev

build:
    pnpm run build

electron:
    pnpm run electron

status:
    git status --short
