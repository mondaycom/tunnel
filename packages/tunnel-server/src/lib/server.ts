import Koa from 'koa';
import tldjs from 'tldjs';
import http, { IncomingHttpHeaders } from 'http';
import Router from 'koa-router';
import { Logger } from 'pino';

import ClientManager from './ClientManager';
import { NewClientResponse } from '@mondaydotcomorg/tunnel-common';
import {
  register as promRegister,
  collectDefaultMetrics,
  Counter,
} from 'prom-client';

collectDefaultMetrics();

const totalTunneledRequestsCounter = new Counter({
  name: 'tunnel_server_total_tunneled_requests',
  help: 'Total tunneled requests',
});

export type ServerOptions = {
  domain?: string;
  secure?: boolean;
  landing?: string;
  maxTcpSockets?: number;
  logger?: Logger;
};

const getHostname = (ctx: {
  headers: IncomingHttpHeaders;
}): string | undefined =>
  (ctx.headers['X-Forwarded-Host'] as string | undefined) ?? ctx.headers.host;

export default function (opt: ServerOptions) {
  opt = opt || {};

  const logger = opt.logger;
  const validHosts = opt.domain ? [opt.domain] : undefined;
  const myTldjs = tldjs.fromUserSettings({ validHosts });

  function getClientIdFromHostname(hostname: string) {
    return myTldjs.getSubdomain(hostname);
  }

  const manager = new ClientManager(opt);

  const schema = opt.secure ? 'https' : 'http';

  const app = new Koa();
  const router = new Router();

  router.get('/api/status', async (ctx) => {
    const stats = manager.stats;
    ctx.body = {
      tunnels: stats.tunnels,
      mem: process.memoryUsage(),
      cpu: process.cpuUsage(),
    };
  });

  router.get('/api/tunnels/:id/status', async (ctx) => {
    const clientId = ctx.params['id'];
    const client = manager.getClient(clientId);
    if (!client) {
      ctx.throw(404, 'Tunnel not found');
      return;
    }

    const stats = client.stats();
    ctx.body = {
      connected_sockets: stats.connectedSockets,
    };
  });

  router.post('/api/tunnels', async (ctx) => {
    const hostname = getHostname(ctx);
    if (!hostname) {
      ctx.throw(400, 'Host header is required');
      return;
    }

    const info = (await manager.newClient()) as NewClientResponse;

    const url = schema + '://' + info.id + '.' + hostname;
    info.url = url;
    ctx.body = info;
  });

  router.post('/api/tunnels/:id', async (ctx) => {
    ctx.headers;
    const hostname = getHostname(ctx);
    if (!hostname) {
      ctx.throw(400, 'Host header is required');
      return;
    }

    const clientId = ctx.params['id'];
    if (
      !/^(?:[a-z0-9][a-z0-9-]{4,63}[a-z0-9]|[a-z0-9]{4,63})$/.test(clientId)
    ) {
      ctx.throw(
        400,
        'Invalid subdomain. Subdomains must be lowercase and between 4 and 63 alphanumeric characters.'
      );
      return;
    }

    const info = await manager.newClient(clientId);

    const url = schema + '://' + info.id + '.' + ctx.request.host;
    const newBody: NewClientResponse = {
      ...info,
      url,
    };
    ctx.body = newBody;
  });

  router.get('/api/metrics', async (ctx) => {
    try {
      ctx.set('Content-Type', promRegister.contentType);
      ctx.body = await promRegister.metrics();
    } catch (ex) {
      ctx.status = 500;
      ctx.body = ex;
    }
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  const server = http.createServer();

  const appCallback = app.callback();

  server.on('request', (req, res) => {
    // without a hostname, we won't know who the request is for
    const hostname = getHostname(req);
    if (!hostname) {
      res.statusCode = 400;
      res.end('Host header is required');
      return;
    }

    const clientId = getClientIdFromHostname(hostname);
    if (!clientId) {
      appCallback(req, res);
      return;
    }

    const client = manager.getClient(clientId);
    if (!client) {
      res.statusCode = 404;
      res.end('404');
      return;
    }

    totalTunneledRequestsCounter.inc();
    client.handleRequest(req, res);
  });

  server.on('upgrade', (req, socket, head) => {
    const hostname = getHostname(req);
    if (!hostname) {
      socket.destroy();
      return;
    }

    const clientId = getClientIdFromHostname(hostname);
    if (!clientId) {
      socket.destroy();
      return;
    }

    const client = manager.getClient(clientId);
    if (!client) {
      socket.destroy();
      return;
    }

    client.handleUpgrade(req, socket);
  });

  return server;
}
