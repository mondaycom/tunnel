import { humanReadableId } from '@alexjamesmalcolm/human-readable-ids';
import { NewClientResult } from '@mondaydotcomorg/tunnel-common';
import { Logger } from 'pino';

import Client from './Client';
import TunnelAgent from './TunnelAgent';

import { Counter, Gauge } from 'prom-client';

const connectedClientsGauge = new Gauge({
  name: 'tunnel_server_connected_clients',
  help: 'Number of connected clients',
});

const totalCreatedTunnelsCounter = new Counter({
  name: 'tunnel_server_total_created_tunnels',
  help: 'Total created tunnels',
});
const totalCreatedTunnelsWithSubdomainCounter = new Counter({
  name: 'tunnel_server_total_created_custom_subdomain_tunnels',
  help: 'Total created tunnels with custom subdomain',
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
  // This is totally wrong :facepalm: this needs to be per-client...
  graceTimeout = null;

  url?: string;

  constructor(readonly opt: ClientManagerOptions = {}) {
    this.logger = opt.logger?.child({ module: ClientManager.name });
  }

  // create a new tunnel with `id`
  // if the id is already used, a random id is assigned
  // if the tunnel could not be created, throws an error
  async newClient(requestedId?: string): Promise<NewClientResult> {
    const clients = this.clients;
    const stats = this.stats;

    const id = this.getNewClientId(requestedId);

    totalCreatedTunnelsCounter.inc();

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

    client.$close.pipe().subscribe(() => {
      this.removeClient(id);
    });

    // try/catch used here to remove client id
    try {
      const info = await agent.listen();
      ++stats.tunnels;
      connectedClientsGauge.inc();
      return {
        id,
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
    this.logger?.debug('removing client: %s', id);
    const client = this.clients.get(id);
    if (!client) {
      return;
    }
    connectedClientsGauge.dec();
    --this.stats.tunnels;
    this.clients.delete(id);
    client.close();
  }

  hasClient(id: string) {
    return !!this.clients.get(id);
  }

  getClient(id: string) {
    return this.clients.get(id);
  }

  private getNewClientId(requestedId: string | undefined): string {
    if (requestedId) {
      // can't ask for id already is use
      if (this.clients.has(requestedId)) {
        const id = humanReadableId();
        this.logger?.debug(
          'making new client with generated id %s - requested client id %s was already in use',
          id,
          requestedId
        );
        return id;
      } else {
        this.logger?.debug('making new client with custom id %s', requestedId);
        totalCreatedTunnelsWithSubdomainCounter.inc();
        return requestedId;
      }
    }

    const id = humanReadableId();
    this.logger?.debug('making new client with generated id %s', id);
    return id;
  }
}

export default ClientManager;
