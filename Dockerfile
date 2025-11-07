# Base Image
FROM node:22-alpine as base
WORKDIR /app

# Dependencies
COPY package*.json ./

# Development stage
FROM base AS dev
# Install dev dependencies
RUN npm ci --legacy-peer-deps
COPY . .

# Create non-root user
RUN addgroup -g 1001 nodejs && adduser -S -G nodejs -u 1001 nodeuser
USER nodeuser

EXPOSE 4000
CMD ["npm", "run", "dev"]