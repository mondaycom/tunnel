FROM node:18.7.0-alpine
WORKDIR /app
COPY ./dist/packages/tunnel-server .
RUN npm install --production

CMD ["node", "./src/cli.js"]
