#!/usr/bin/env node
import dotenv from 'dotenv';
import yargs from 'yargs/yargs';
import pino from 'pino';
import pretty from 'pino-pretty';
import { version } from '../package.json';
import createTunnel from './lib/createTunnel';
import { TUNNEL_DEFAULT_HOST } from './constants';

const y = yargs(process.argv.slice(2))
  .usage('Usage: mtunnel --port [num] <options>')
  .option('port', {
    alias: 'p',
    describe: 'Internal HTTP server port',
    demandOption: true,
    type: 'number',
  })
  .option('host', {
    alias: 'h',
    describe: 'Upstream server providing forwarding',
    default: TUNNEL_DEFAULT_HOST,
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
  .option('env-file', {
    alias: 'e',
    describe: 'Loads parameters from .env file',
    default: '.env',
    type: 'string',
    conflicts: 'no-env-file',
  })
  .option('no-env-file', {
    describe: 'Skips loading parameters from .env file',
    type: 'boolean',
    conflicts: 'env-file',
  })
  .option('print-requests', {
    describe: 'Print basic request info',
    type: 'boolean',
  })
  .env('TUNNEL')
  .help('help', 'Show th-is help and exit')
  .version(version);

let argv = y.parse();
if (!argv['no-env-file']) {
  dotenv.config({ path: argv['env-file'] });
  argv = y.parse();
}

const logger = pino(
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
