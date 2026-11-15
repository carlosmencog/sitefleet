FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm ci
COPY . .
RUN npm run build
RUN npm run build:dashboard
CMD ["node", "apps/api/dist/src/server.js"]
