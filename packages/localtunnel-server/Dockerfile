FROM node:18.7.0-alpine
WORKDIR /app
COPY ./dist/packages/localtunnel-server .
ENV LOCALTUNNEL_SERVER_PORT=8000
EXPOSE ${LOCALTUNNEL_SERVER_PORT}
RUN npm install --production

CMD ["node", "./src/cli.js"]
