import http from 'http';
import pump from 'pump';
import EventEmitter from 'events';
import TunnelAgent from './TunnelAgent';
import internal from 'stream';
import { hasCode } from '@mondaydotcomorg/localtunnel-common';
import { Logger } from 'pino';
import { Subject } from 'rxjs';

type ClientOptions = {
  agent: TunnelAgent;
  id: string;
  logger?: Logger;
};

// A client encapsulates req/res handling using an agent
//
// If an agent is destroyed, the request handling will error
// The caller is responsible for handling a failed request
class Client {
  graceTimeout: NodeJS.Timeout;
  agent: TunnelAgent;
  id: string;
  logger?: Logger;
  $close = new Subject<void>();

  constructor(options: ClientOptions) {
    this.agent = options.agent;
    this.id = options.id;
    this.logger = options.logger?.child({ module: Client.name, client: this.id });

    // client is given a grace period in which they can connect before they are _removed_
    this.graceTimeout = setTimeout(() => {
      this.close();
    }, 1000).unref();

    this.agent.$online.subscribe(() => {
      this.logger?.debug('client online %s', this.id);
      clearTimeout(this.graceTimeout);
    });

    this.agent.$offline.subscribe(() => {
      this.logger?.debug('client offline %s', this.id);

      // if there was a previous timeout set, we don't want to double trigger
      clearTimeout(this.graceTimeout);

      // client is given a grace period in which they can re-connect before they are _removed_
      this.graceTimeout = setTimeout(() => {
        this.close();
      }, 1000).unref();
    });
  }

  stats() {
    return this.agent.stats();
  }

  close() {
    clearTimeout(this.graceTimeout);
    this.agent.destroy();
    this.$close.next();
  }

  handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    this.logger?.debug('> %s', req.url);
    const opt = {
      path: req.url,
      agent: this.agent,
      method: req.method,
      headers: req.headers,
    };

    const clientReq = http.request(opt, (clientRes) => {
      this.logger?.debug('< %s', req.url);
      // write response code and headers
      res.writeHead(clientRes.statusCode!, clientRes.headers);

      // using pump is deliberate - see the pump docs for why
      pump(clientRes, res);
    });

    // this can happen when underlying agent produces an error
    // in our case we 504 gateway error this?
    // if we have already sent headers?
    clientReq.once('error', (err) => {
      // TODO(roman): if headers not sent - respond with gateway unavailable
      this.logger?.debug(err);
    });

    // using pump is deliberate - see the pump docs for why
    pump(req, clientReq);
  }

  handleUpgrade(req: http.IncomingMessage, socket: internal.Duplex) {
    this.logger?.debug('> [up] %s', req.url);
    socket.once('error', (err) => {
      // These client side errors can happen if the client dies while we are reading
      // We don't need to surface these in our logs.
      if (
        hasCode(err) &&
        (err.code == 'ECONNRESET' || err.code == 'ETIMEDOUT')
      ) {
        return;
      }
      this.logger?.error(err);
    });

    this.agent.createConnection({}, (err, conn) => {
      this.logger?.debug('< [up] %s', req.url);
      // any errors getting a connection mean we cannot service this request
      if (err || !conn) {
        socket.end();
        return;
      }

      // socket met have disconnected while we waiting for a socket
      if (!socket.readable || !socket.writable) {
        conn.destroy();
        socket.end();
        return;
      }

      // websocket requests are special in that we simply re-create the header info
      // then directly pipe the socket data
      // avoids having to rebuild the request and handle upgrades via the http client
      const arr = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length - 1; i += 2) {
        arr.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      }

      arr.push('');
      arr.push('');

      // using pump is deliberate - see the pump docs for why
      pump(conn, socket);
      pump(socket, conn);
      conn.write(arr.join('\r\n'));
    });
  }
}

export default Client;
