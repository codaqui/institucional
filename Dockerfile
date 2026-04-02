FROM node:24-alpine
WORKDIR /app

# Application resources are root-owned and read-only for security (S6504)
# Config files are read-only (444), source and app code are read-execute (555)
COPY --chown=root:root --chmod=444 package.json package-lock.json ./
RUN npm ci

COPY --chown=root:root --chmod=555 . .

# Ensure Docusaurus has write access to its own metadata/cache
RUN mkdir -p .docusaurus .cache && chown -R node:node .docusaurus .cache

# Start dev server as non-root user
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
