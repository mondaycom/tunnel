FROM node:18.7.0-alpine
WORKDIR /app
COPY ./dist/packages/tunnel .
ENV TUNNEL_PORT=3000
EXPOSE ${TUNNEL_PORT}
RUN npm install --production

CMD ["node", "./src/cli.js"]
