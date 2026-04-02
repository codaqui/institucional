FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
# Utilizando curl conforme referencia externa de saude
RUN apk add --no-cache curl
WORKDIR /app
ENV NODE_ENV=production

# Application resources are root-owned and read-only for security (S6504)
# Config files are read-only (444), dist/ is read-execute (555)
COPY --from=builder --chown=root:root --chmod=444 /app/package.json ./package.json
COPY --from=builder --chown=root:root --chmod=444 /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev

COPY --from=builder --chown=root:root --chmod=555 /app/dist ./dist

# Start application as non-root user (uid 1000)
USER node
EXPOSE 3000
ENV PORT=3000
CMD ["node", "dist/main.js"]
