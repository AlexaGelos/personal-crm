# Production image of the app. CI builds it on every push to main
# (.github/workflows/deploy.yml); the server only pulls and runs it.

FROM node:24-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm version comes from "packageManager" in package.json
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN STANDALONE_BUILD=1 pnpm build

# Migrations and seeding run outside Next.js: compile them to plain JS and put
# their only two dependencies next to them
RUN pnpm exec tsc src/db/migrate.ts src/db/seed.ts \
      --outDir tools/db --module nodenext --target es2022 --skipLibCheck --types node \
 && mkdir tools/node_modules \
 && cp -rL node_modules/drizzle-orm node_modules/postgres tools/node_modules/


FROM node:24-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app

# The app writes its cache into .next, so it belongs to the unprivileged "node" user
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/tools ./tools

USER node
EXPOSE 3000

# Checked by Docker (status "healthy" in docker ps); the deploy smoke check is in deploy/deploy.sh
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Migrations: node tools/db/migrate.js   Test data: node tools/db/seed.js
CMD ["node", "server.js"]
