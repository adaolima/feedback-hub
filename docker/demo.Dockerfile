FROM node:20-alpine
WORKDIR /repo

COPY package.json ./
COPY apps/demo/package.json apps/demo/

RUN npm install --workspace apps/demo --include-workspace-root

COPY apps/demo apps/demo

ENV PORT=3001
EXPOSE 3001
CMD ["node", "apps/demo/server.js"]
