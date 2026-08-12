# --- Build shared package + SDK + API ---
FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/sdk/package.json packages/sdk/
COPY apps/api/package.json apps/api/

RUN npm install --workspace apps/api --workspace packages/shared --workspace packages/sdk --include-workspace-root

COPY packages/shared packages/shared
COPY packages/sdk packages/sdk
COPY apps/api apps/api
COPY database database

RUN npm run build --workspace packages/shared
RUN npm run build --workspace packages/sdk
RUN npm run build --workspace apps/api

# --- Runtime image ---
FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm install --workspace apps/api --workspace packages/shared --include-workspace-root --omit=dev

COPY --from=builder /repo/packages/shared/dist packages/shared/dist
COPY --from=builder /repo/packages/sdk/dist packages/sdk/dist
COPY --from=builder /repo/apps/api/dist apps/api/dist
COPY --from=builder /repo/apps/api/openapi.yaml apps/api/openapi.yaml
COPY database database

EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
