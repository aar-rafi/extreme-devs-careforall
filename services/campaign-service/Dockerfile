FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared ./shared

# Copy service package files and update shared path
COPY services/campaign-service/package*.json ./
RUN sed -i 's|file:../../shared|file:./shared|g' package.json

# Install dependencies
RUN npm install --production

# Copy service source code
COPY services/campaign-service/src ./src

# Expose port
EXPOSE 3002

# Set environment
ENV NODE_ENV=production
ENV campaign-service=campaign-service

# Start service
CMD ["node", "src/index.js"]
