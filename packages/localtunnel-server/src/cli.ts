#!/usr/bin/env node

import yargs from 'yargs';
import pino from 'pino';
import { AddressInfo } from 'net';

import createServer from './lib/server';

const { argv } = yargs(process.argv.slice(2))
  .usage('Usage: $0 --port [num]')
  .options('secure', {
    default: false,
    describe: 'use this flag to indicate proxy over https',
    type: 'boolean',
  })
  .options('port', {
    default: 80,
    describe: 'listen on this port for outside requests',
    type: 'number',
  })
  .options('address', {
    default: '0.0.0.0',
    describe: 'IP address to bind to',
    type: 'string',
  })
  .options('domain', {
    describe:
      'Specify the base domain name. This is optional if hosting localtunnel from a regular example.com domain. This is required if hosting a localtunnel server from a subdomain (i.e. lt.example.dom where clients will be client-app.lt.example.come)',
    type: 'string',
  })
  .options('max-sockets', {
    default: 2,
    describe:
      'maximum number of tcp sockets each client is allowed to establish at one time (the tunnels)',
    type: 'number',
  })
  .option('debug', {
    alias: 'd',
    describe: 'Print more verbose logs',
    type: 'boolean',
  })
  .showHelpOnFail(true)
  .help('help');

export const logger = pino({
  level: argv.debug ? 'debug' : 'info',
});

const server = createServer({
  maxTcpSockets: argv['max-sockets'],
  secure: argv.secure,
  domain: argv.domain,
  logger,
});

server.listen(argv.port, argv.address, () => {
  logger.info(
    'server listening on port: %d',
    (server.address() as AddressInfo).port
  );
});

process.on('SIGINT', () => {
  process.exit();
});

process.on('SIGTERM', () => {
  process.exit();
});

process.on('uncaughtException', (err) => {
  logger.error(err);
});

process.on('unhandledRejection', (reason) => {
  logger.error(reason);
});
