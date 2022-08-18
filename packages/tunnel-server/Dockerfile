FROM node:18.7.0-alpine
WORKDIR /app
COPY ./dist/packages/tunnel-server .
ENV TUNNEL_SERVER_PORT=8000
EXPOSE ${TUNNEL_SERVER_PORT}
RUN npm install --production

CMD ["node", "./src/cli.js"]
