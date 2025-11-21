FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY ../../shared ./shared

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV SERVICE_NAME=auth-service

# Start service
CMD ["node", "src/index.js"]
