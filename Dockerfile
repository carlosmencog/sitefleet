FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci
COPY . .
RUN npm run build
CMD ["node", "apps/api/dist/src/server.js"]
