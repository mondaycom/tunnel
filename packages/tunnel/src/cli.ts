#!/usr/bin/env node

import yargs from 'yargs';

import createTunnel from './lib/createTunnel';
import { version } from '../package.json';
import pino from 'pino';
import pretty from 'pino-pretty';

const { argv } = yargs
  .usage('Usage: lt --port [num] <options>')
  .env('TUNNEL')
  .option('port', {
    alias: 'p',
    describe: 'Internal HTTP server port',
    demandOption: true,
    type: 'number',
  })
  .option('host', {
    alias: 'h',
    describe: 'Upstream server providing forwarding',
    default: 'https://tunnel.monday.app',
  })
  .option('subdomain', {
    alias: 's',
    describe: 'Request this subdomain',
    type: 'string',
  })
  .option('local-host', {
    alias: 'l',
    describe:
      'Tunnel traffic to this host instead of localhost, override Host header to this host',
    type: 'string',
  })
  .options('open', {
    alias: 'o',
    describe: 'Opens the tunnel URL in your browser',
    type: 'boolean',
  })
  .option('debug', {
    alias: 'd',
    describe: 'Print more verbose logs',
    type: 'boolean',
  })
  .option('print-requests', {
    describe: 'Print basic request info',
    type: 'boolean',
  })
  .help('help', 'Show this help and exit')
  .version(version);

export const logger = pino(
  {
    level: argv.debug ? 'debug' : 'info',
  },
  pretty({
    ignore: 'pid,hostname',
    singleLine: true,
    translateTime: 'SYS:HH:MM:ss.l',
  })
);

(async () => {
  const tunnel = await createTunnel({
    port: argv.port,
    host: argv.host,
    subdomain: argv.subdomain,
    localHost: argv['local-host'],
    logger,
  }).catch((err: Error) => {
    logger.error({ err });
    process.exit(1);
  });

  tunnel.$error.subscribe((err) => {
    logger.error({ err });
  });

  logger.info('your url is: %s', tunnel.info?.url);

  if (argv['print-requests']) {
    tunnel.$request.subscribe((info) => {
      logger.info(`${info.method} - ${info.path}`);
    });
  }
})();
