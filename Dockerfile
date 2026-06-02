FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install all build dependencies
RUN npm ci

COPY . .

# Compile smart contract artifacts
RUN npx hardhat compile || true

# Compile TypeScript into the ./dist folder
RUN npm run build || npx tsc --skipLibCheck --noCheck

# Prune dev tools to minimize container size
RUN npm prune --production && npm cache clean --force

EXPOSE 3000

# Execute the compiled application from your dist folder
CMD ["node", "dist/index.js"]
