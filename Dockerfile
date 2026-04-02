FROM node:24-alpine
WORKDIR /app

# Ensure /app belongs to node user
RUN chown node:node /app

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .

# Start dev server as non-root user
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
