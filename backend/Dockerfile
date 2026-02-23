FROM node:18-alpine
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server/index.js"]
