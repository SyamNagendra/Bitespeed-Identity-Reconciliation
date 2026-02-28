FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL so Prisma detects 3.x and uses debian-openssl-3.0.x engine
RUN apt-get update -y && apt-get install -y openssl ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

COPY . .
RUN npm run db:generate
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app

# Install OpenSSL so Prisma engine can load libssl.so.3 at runtime
RUN apt-get update -y && apt-get install -y openssl ca-certificates --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
