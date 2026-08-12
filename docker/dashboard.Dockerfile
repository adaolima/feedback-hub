FROM node:20-alpine AS builder
WORKDIR /repo

COPY package.json ./
COPY apps/dashboard/package.json apps/dashboard/

RUN npm install --workspace apps/dashboard --include-workspace-root

COPY apps/dashboard apps/dashboard

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace apps/dashboard

FROM node:20-alpine AS runtime
WORKDIR /repo/apps/dashboard
ENV NODE_ENV=production

COPY --from=builder /repo/apps/dashboard/.next ./.next
COPY --from=builder /repo/apps/dashboard/public ./public
COPY --from=builder /repo/apps/dashboard/package.json ./package.json
COPY --from=builder /repo/node_modules /repo/node_modules

EXPOSE 3000
CMD ["/repo/node_modules/.bin/next", "start", "-p", "3000"]
