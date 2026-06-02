FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies first so the TypeScript build succeeds
RUN npm ci

COPY . .

RUN npm run build

# Remove development dependencies afterward to keep it clean
RUN npm prune --production && npm cache clean --force

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => (res.statusCode !== 200) ? process.exit(1) : process.exit(0))"

CMD ["npm", "start"]
