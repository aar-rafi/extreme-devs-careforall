FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared ./shared

# Copy service package files and update shared path
COPY services/admin-service/package*.json ./
RUN sed -i 's|file:../../shared|file:./shared|g' package.json

# Install dependencies
RUN npm install --production

# Copy service source code
COPY services/admin-service/src ./src

# Expose port
EXPOSE 3006

# Set environment
ENV NODE_ENV=production
ENV admin-service=admin-service

# Start service
CMD ["node", "src/index.js"]
