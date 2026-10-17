# pnpm 11 (packageManager) needs Node >= 22.13, and Nixpacks' corepack@0.24.1
# cannot load it, so the image installs pnpm directly instead of via corepack.
FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.7.0

ENV CI=true
WORKDIR /app

# Dokploy writes the app's environment to .env in the build context
# (createEnvFile), which prisma.config.ts and `next build` read at build time.
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

ENV NODE_ENV=production
# Dokploy's domain routes to this port.
ENV PORT=3564
EXPOSE 3564

CMD ["sh", "-c", "npx prisma migrate deploy && pnpm start"]
