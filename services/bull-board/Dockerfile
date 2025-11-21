FROM node:20-alpine

WORKDIR /app

# Copy shared library
COPY shared ./shared

# Copy service package files and update shared path
COPY services/bull-board/package*.json ./
RUN sed -i 's|file:../../shared|file:./shared|g' package.json

# Install dependencies
RUN npm install --production

# Copy service source code
COPY services/bull-board/src ./src

# Expose port
EXPOSE 3100

# Set environment
ENV NODE_ENV=production
ENV bull-board=bull-board

# Start service
CMD ["node", "src/index.js"]
