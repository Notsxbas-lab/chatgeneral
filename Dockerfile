FROM node:18-alpine

WORKDIR /app

# copy only package files first for better caching
COPY package*.json ./

RUN npm install --production

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
