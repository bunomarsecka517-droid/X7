FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm ci

COPY . .

# Compile TypeScript bypassing type rules
RUN npm run build

# Strip dev dependencies to conserve space
RUN npm prune --production && npm cache clean --force

# Let Railway dynamically bind to its own port variable
EXPOSE 3000

CMD ["npm", "start"]
