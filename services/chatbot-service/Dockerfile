# Chatbot Service Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy shared module first
COPY shared /app/shared
WORKDIR /app/shared
RUN npm install && npm link

# Copy service files
WORKDIR /app/chatbot-service
COPY services/chatbot-service/package*.json ./
RUN npm install && npm link @careforall/shared

COPY services/chatbot-service/ ./

EXPOSE 3008

CMD ["npm", "start"]
