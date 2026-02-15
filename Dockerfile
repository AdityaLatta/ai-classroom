FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY knexfile.ts ./

RUN npm run build
# Compile knexfile for production (no ts-node needed at runtime)
RUN npx tsc knexfile.ts --outDir dist --esModuleInterop --module commonjs --skipLibCheck

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

EXPOSE 8000

# Run migrations then start server
CMD ["sh", "-c", "npx knex migrate:latest --knexfile dist/knexfile.js && node dist/server.js"]
