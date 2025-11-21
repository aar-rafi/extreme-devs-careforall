FROM node:20-alpine

WORKDIR /app

COPY services/load-tester/package.json ./

RUN npm install --only=production

COPY services/load-tester/src ./src

ENV NODE_ENV=production

CMD ["node", "src/index.js"]


