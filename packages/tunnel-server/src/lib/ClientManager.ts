import { humanReadableId } from '@alexjamesmalcolm/human-readable-ids';
import { NewClientResult } from '@mondaydotcomorg/tunnel-common';
import { Logger } from 'pino';

import Client from './Client';
import TunnelAgent from './TunnelAgent';

import { Gauge } from 'prom-client';

const connectedClientsHistogram = new Gauge({
  name: 'tunnel_server_connected_clients',
  help: 'Number of connected clients',
});

type ClientManagerOptions = {
  maxTcpSockets?: number;
  logger?: Logger;
};

// Manage sets of clients
//
// A client is a "user session" established to service a remote tunnel client
class ClientManager {
  clients = new Map<string, Client>();
  logger?: Logger;
  stats = {
    tunnels: 0,
  };

  url?: string;

  constructor(readonly opt: ClientManagerOptions = {}) {
    this.logger = opt.logger?.child({ module: ClientManager.name });
  }

  // create a new tunnel with `id`
  // if the id is already used, a random id is assigned
  // if the tunnel could not be created, throws an error
  async newClient(id: string): Promise<NewClientResult> {
    const clients = this.clients;
    const stats = this.stats;

    // can't ask for id already is use
    if (this.clients.has(id)) {
      const newId = humanReadableId();
      this.logger?.debug(
        'making new client with id %s (was requesting: %s)',
        newId,
        id,
        { client: newId }
      );
      id = newId;
    } else {
      this.logger?.debug('making new client with id %s', id, { client: id });
    }

    const maxSockets = this.opt.maxTcpSockets;
    const agent = new TunnelAgent({
      clientId: id,
      maxSockets,
      logger: this.logger,
    });

    const client = new Client({
      id,
      agent,
      logger: this.logger,
    });

    // add to clients map immediately
    // avoiding races with other clients requesting same id
    clients.set(id, client);

    client.$close.subscribe(() => {
      this.removeClient(id);
    });

    // try/catch used here to remove client id
    try {
      const info = await agent.listen();
      ++stats.tunnels;
      connectedClientsHistogram.inc();
      return {
        id: id,
        port: info.port,
        maxConnCount: maxSockets,
      };
    } catch (err) {
      this.removeClient(id);
      // rethrow error for upstream to handle
      throw err;
    }
  }

  removeClient(id: string) {
    this.logger?.debug('removing client: %s', id, { client: id });
    const client = this.clients.get(id);
    if (!client) {
      return;
    }
    connectedClientsHistogram.dec();
    --this.stats.tunnels;
    this.clients.delete(id);
    this.logger?.debug('removed client: %s', id, { client: id });
  }

  hasClient(id: string) {
    return !!this.clients.get(id);
  }

  getClient(id: string) {
    return this.clients.get(id);
  }
}

export default ClientManager;
