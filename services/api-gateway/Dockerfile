FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared ./shared

# Copy service package files and update shared path
COPY services/api-gateway/package*.json ./
RUN sed -i 's|file:../../shared|file:./shared|g' package.json

# Install dependencies
RUN npm install --production

# Copy service source code
COPY services/api-gateway/src ./src

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV api-gateway=api-gateway

# Start service
CMD ["node", "src/index.js"]
