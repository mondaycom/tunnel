#!/usr/bin/env node

import yargs from 'yargs';

import localtunnel from './lib/localtunnel';
import { version } from '../package.json';
import pino from 'pino';

const { argv } = yargs
  .usage('Usage: lt --port [num] <options>')
  .env(true)
  .option('port', {
    alias: 'p',
    describe: 'Internal HTTP server port',
    demandOption: true,
    type: 'number',
  })
  .option('host', {
    alias: 'h',
    describe: 'Upstream server providing forwarding',
    default: 'https://tunnel.monday.com',
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
  .option('local-https', {
    describe: 'Tunnel traffic to a local HTTPS server',
    type: 'boolean',
  })
  .option('local-cert', {
    describe: 'Path to certificate PEM file for local HTTPS server',
    type: 'string',
    implies: 'local-https',
  })
  .option('local-key', {
    describe: 'Path to certificate key file for local HTTPS server',
    type: 'string',
    implies: 'local-https',
  })
  .option('local-ca', {
    describe: 'Path to certificate authority file for self-signed certificates',
    type: 'string',
    implies: 'local-https',
  })
  .option('allow-invalid-cert', {
    describe:
      'Disable certificate checks for your local HTTPS server (ignore cert/key/ca options)',
    type: 'boolean',
    implies: 'local-https',
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

export const logger = pino({
  transport: {
    target: 'pino-pretty',
  },
  level: argv.debug ? 'debug' : 'info',
});

(async () => {
  const tunnel = await localtunnel({
    port: argv.port,
    host: argv.host,
    subdomain: argv.subdomain,
    localHost: argv['local-host'],
    localHttps: argv['local-https'],
    localCert: argv['local-cert'],
    localKey: argv['local-key'],
    localCa: argv['local-ca'],
    allowInvalidCert: argv['allow-invalid-cert'],
    logger,
  }).catch((err: Error) => {
    throw err;
  });

  tunnel.$error.subscribe((err) => {
    throw err;
  });

  logger.info('your url is: %s', tunnel.info?.url);

  if (argv['print-requests']) {
    tunnel.$request.subscribe((info) => {
      logger.info(new Date().toString(), info.method, info.path);
    });
  }
})();
