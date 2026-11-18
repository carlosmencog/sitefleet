FROM node:22-alpine

RUN apk add --no-cache chromium ca-certificates freetype harfbuzz nss ttf-freefont
ENV CHROME_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/dashboard/package.json apps/dashboard/package.json
RUN npm ci
COPY . .
RUN npm run build:dashboard

CMD ["npm", "run", "start", "--workspace=@sitefleet/dashboard"]
