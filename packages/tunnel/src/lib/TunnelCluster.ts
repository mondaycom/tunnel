import net from 'node:net';
import { Readable } from 'node:stream';
import { hasCode } from '@mondaydotcomorg/tunnel-common';

import { HeaderHostTransformer } from './HeaderHostTransformer';
import { Subject } from 'rxjs';
import { Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import { TunnelInfo } from './types';

export interface TunnelRequestInfo {
  method: string;
  path: string;
}

export interface TunnelClusterOptions extends TunnelInfo {
  logger?: Logger;
}

export class TunnelCluster {
  $open = new Subject<{ tunnelId: string; socket: net.Socket }>();
  $error = new Subject<Error>();
  $dead = new Subject<{ tunnelId: string }>();
  $request = new Subject<TunnelRequestInfo>();
  logger?: Logger;

  get remoteHostOrIp() {
    return this.opts.remoteIp || this.opts.remoteHost;
  }
  get localHost() {
    return this.opts.localHost || 'localhost';
  }
  readonly localProtocol = 'http';

  constructor(readonly opts: TunnelClusterOptions) {
    this.logger = this.opts.logger;
  }

  async open() {
    const tunnelId = TunnelCluster.getRandomTunnelId();
    const logger = this.logger?.child({ tunnelId });
    logger?.debug(
      'establishing tunnel %s://%s:%s <> %s:%s',
      this.localProtocol,
      this.localHost,
      this.opts.localPort,
      this.remoteHostOrIp,
      this.opts.remotePort
    );

    // connection to tunnel server
    const remote = net.connect({
      host: this.remoteHostOrIp,
      port: this.opts.remotePort,
    });

    remote.setKeepAlive(true);

    remote.on('error', (err) => {
      logger?.error('got remote connection error %s', err.message);
      remote.end();

      // emit connection refused errors immediately, because they
      // indicate that the tunnel can't be established.
      if (hasCode(err) && err.code === 'ECONNREFUSED') {
        this.$error.next(
          new Error(
            `${tunnelId} connection refused: ${this.remoteHostOrIp}:${this.opts.remotePort} (check your firewall settings)`
          )
        );
      }
    });
    remote.on('data', (data) => {
      const match = data.toString().match(/^(\w+) (\S+)/);
      if (match) {
        this.$request.next({
          method: match[1],
          path: match[2],
        });
      }
    });

    // tunnel is considered open when remote connects
    return new Promise((resolve) => {
      remote.once('connect', () => {
        this.$open.next({ socket: remote, tunnelId });
        resolve(remote);
        this.connLocal(remote, tunnelId);
      });
    });
  }

  private connLocal = (remote: net.Socket, tunnelId: string) => {
    const logger = this.logger?.child({ tunnelId });
    if (remote.destroyed) {
      logger?.debug('remote destroyed');
      this.$dead.next({ tunnelId });
      return;
    }

    logger?.debug(
      'connecting locally to %s://%s:%d',
      this.localProtocol,
      this.localHost,
      this.opts.localPort
    );
    remote.pause();

    // connection to local http server
    const local = net.connect(this.opts.localPort, this.localHost);

    const remoteClose = () => {
      logger?.debug('remote close');
      this.$dead.next({ tunnelId });
      local.end();
    };

    remote.once('close', remoteClose);

    // TODO some languages have single threaded servers which makes opening up
    // multiple local connections impossible. We need a smarter way to scale
    // and adjust for such instances to avoid beating on the door of the server
    local.once('error', (err) => {
      logger?.debug('local error %s', err.message);
      local.end();

      remote.removeListener('close', remoteClose);

      if (!hasCode(err) || err.code !== 'ECONNREFUSED') {
        remote.end();
        return;
      }
      // retrying connection to local server
      setTimeout(() => this.connLocal(remote, tunnelId), 1000);
    });

    local.once('connect', () => {
      logger?.debug('connected locally');
      remote.resume();

      let stream: Readable = remote;

      // if user requested specific local host
      // then we use host header transform to replace the host header
      if (this.opts.localHost) {
        logger?.debug('transform Host header to %s', this.opts.localHost);
        stream = remote.pipe(
          new HeaderHostTransformer({ host: this.opts.localHost })
        );
      }

      stream.pipe(local).pipe(remote);

      // when local closes, also get a new remote
      local.once('close', (hadError) => {
        logger?.debug('local connection closed [error: %s]', hadError);
      });
    });
  };

  private static getRandomTunnelId() {
    return randomUUID().substring(0, 6);
  }
}
