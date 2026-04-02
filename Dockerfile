FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Start dev server
EXPOSE 3000
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
