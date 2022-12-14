import { Agent, ClientRequestArgs } from 'http';
import net from 'net';
import { hasCode } from '@mondaydotcomorg/tunnel-common';
import { AddressInfo, EventEmitter } from 'ws';
import { Subject } from 'rxjs';
import { Logger } from 'pino';

const DEFAULT_MAX_SOCKETS = 10;

type TunnelAgentOptions = {
  clientId?: string;
  maxSockets?: number;
  logger?: Logger;
};

type ClientInfo = {
  ip?: string;
};

type SocketInfo = ClientInfo & {
  port?: number;
};

type CreateConnectionCallback = (
  err: Error | null,
  socket: net.Socket | null
) => void;

// Implements an http.Agent interface to a pool of tunnel sockets
// A tunnel socket is a connection _from_ a client that will
// service http requests. This agent is usable wherever one can use an http.Agent
class TunnelAgent extends Agent {
  // sockets we can hand out via createConnection
  availableSockets: net.Socket[] = [];

  // when a createConnection cannot return a socket, it goes into a queue
  // once a socket is available it is handed out to the next callback
  waitingCreateConn: CreateConnectionCallback[] = [];

  // track maximum allowed sockets
  connectedSockets = 0;

  logger?: Logger;
  server: net.Server;
  started = false;
  closed = false;
  events = new EventEmitter();

  $online = new Subject<ClientInfo>();
  $offline = new Subject<ClientInfo>();
  $end = new Subject<void>();

  constructor(options: TunnelAgentOptions = {}) {
    super({
      keepAlive: true,
      // only allow keepalive to hold on to one socket
      // this prevents it from holding on to all the sockets so they can be used for upgrades
      maxFreeSockets: 1,
    });
    this.logger = options.logger?.child({
      module: TunnelAgent.name,
      client: options.clientId,
    });
    this.maxSockets = options.maxSockets || DEFAULT_MAX_SOCKETS;

    // new tcp server to service requests for this client
    this.server = net.createServer();
  }

  stats() {
    return {
      connectedSockets: this.connectedSockets,
      availableSockets: this.availableSockets.length,
      waitingConnections: this.waitingCreateConn.length,
    };
  }

  listen(): Promise<{ port: number }> {
    const server = this.server;
    if (this.started) {
      throw new Error('already started');
    }
    this.started = true;

    server.on('close', this._onClose);
    server.on('connection', this._onConnection);
    server.on('error', (err) => {
      // These errors happen from killed connections, we don't worry about them
      if (
        hasCode(err) &&
        (err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT')
      ) {
        return;
      }
      this.logger?.error(err);
    });

    return new Promise((resolve) => {
      server.listen(() => {
        const port = (server.address() as AddressInfo).port;
        this.logger?.info('tcp server listening on port: %d', port);

        resolve({
          // port for mtunnel client tcp connections
          port: port,
        });
      });
    });
  }

  private _onClose = () => {
    this.closed = true;
    this.logger?.debug('closed tcp socket');
    // flush any waiting connections
    for (const conn of this.waitingCreateConn) {
      conn(new Error('closed'), null);
    }
    this.waitingCreateConn = [];
    this.$end.next();
  };

  // new socket connection from client for tunneling requests to client
  private _onConnection = (socket: net.Socket): void => {
    socket.setKeepAlive(true, 10000);

    const clientInfo: ClientInfo = {
      ip: socket.remoteAddress,
    };
    const socketInfo: SocketInfo = {
      ...clientInfo,
      port: socket.remotePort,
    };
    const socketLogger = this.logger?.child(socketInfo);

    // no more socket connections allowed
    if (this.connectedSockets >= this.maxSockets) {
      socketLogger?.debug(this.stats(), 'no more sockets allowed');
      socket.destroy();
      return;
    }

    socket.once('close', (hadError) => {
      this.connectedSockets -= 1;
      // remove the socket from available list
      const idx = this.availableSockets.indexOf(socket);
      if (idx >= 0) {
        this.availableSockets.splice(idx, 1);
      }

      socketLogger?.debug(this.stats(), 'socket closed (error: %s)', hadError);
      if (this.connectedSockets <= 0) {
        socketLogger?.debug('all sockets disconnected');
        this.$offline.next(clientInfo);
      }
    });

    socket.on('data', () => {
      // always make sure the data is read to prevent socket hanging
    });

    // close will be emitted after this
    socket.once('error', (err) => {
      socketLogger?.debug('socket error: %s', err);
      // we do not log these errors, sessions can drop from clients for many reasons
      // these are not actionable errors for our server
      socket.destroy();
    });

    if (this.connectedSockets === 0) {
      this.$online.next(clientInfo);
    }

    this.connectedSockets += 1;

    socketLogger?.debug(this.stats(), 'socket opened');

    // if there are queued callbacks, give this socket now and don't queue into available
    const fn = this.waitingCreateConn.shift();
    if (fn) {
      socketLogger?.debug(
        this.stats(),
        'socket given to queued connection'
      );
      setTimeout(() => {
        fn(null, socket);
      }, 0);
      return;
    }

    // make socket available for those waiting on sockets
    this.availableSockets.push(socket);
    socketLogger?.debug(this.stats(), 'socket waiting for new connection');
  };

  // fetch a socket from the available socket pool for the agent
  // if no socket is available, queue
  // cb(err, socket)
  createConnection = (
    options: ClientRequestArgs,
    cb: CreateConnectionCallback
  ) => {
    if (this.closed) {
      cb(new Error('closed'), null);
      return;
    }

    this.logger?.debug('create connection');

    // socket is a tcp connection back to the user hosting the site
    const sock = this.availableSockets.shift();

    // no available sockets
    // wait until we have one
    if (!sock) {
      this.waitingCreateConn.push(cb);
      this.logger?.debug(this.stats(), 'no available sockets');
      return;
    }

    this.logger?.debug(this.stats(), 'socket given');
    cb(null, sock);
  };

  override destroy() {
    this.server.close();
    this.$online.complete();
    this.$offline.complete();
    this.$end.complete();
    super.destroy();
  }
}

export default TunnelAgent;
