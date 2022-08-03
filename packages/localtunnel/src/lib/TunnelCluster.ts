import fs from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';
import { Readable } from 'node:stream';
import { hasCode } from '@mondaydotcomorg/localtunnel-common';

import { HeaderHostTransformer } from './HeaderHostTransformer';
import { TunnelInfo } from './Tunnel';
import { Subject } from 'rxjs';
import { Logger } from 'pino';

export interface TunnelRequestInfo {
  method: string;
  path: string;
}

export interface TunnelClusterOptions extends TunnelInfo {
  logger?: Logger;
}

// manages groups of tunnels
export class TunnelCluster {
  $open = new Subject<net.Socket>();
  $error = new Subject<Error>();
  $dead = new Subject<void>();
  $request = new Subject<TunnelRequestInfo>();
  logger?: Logger;

  get remoteHostOrIp() {
    return this.opts.remoteIp || this.opts.remoteHost;
  }
  get localHost() {
    return this.opts.localHost || 'localhost';
  }
  get localProtocol() {
    return this.opts.localHttps ? 'https' : 'http';
  }

  constructor(readonly opts: TunnelClusterOptions) {
    this.logger = this.opts.logger;
  }

  open() {
    this.logger?.debug(
      'establishing tunnel %s://%s:%s <> %s:%s',
      this.localProtocol,
      this.localHost,
      this.opts.localPort,
      this.remoteHostOrIp,
      this.opts.remotePort
    );

    // connection to localtunnel server
    const remote = net.connect({
      host: this.remoteHostOrIp,
      port: this.opts.remotePort,
    });

    remote.setKeepAlive(true);

    remote.on('error', (err) => {
      this.logger?.debug('got remote connection error %s', err.message);
      remote.end();

      // emit connection refused errors immediately, because they
      // indicate that the tunnel can't be established.
      if (hasCode(err) && err.code === 'ECONNREFUSED') {
        this.$error.next(
          new Error(
            `connection refused: ${this.remoteHostOrIp}:${this.opts.remotePort} (check your firewall settings)`
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
    remote.once('connect', () => {
      this.$open.next(remote);
      this.connLocal(remote);
    });
  }

  private connLocal = (remote: net.Socket) => {
    if (remote.destroyed) {
      this.logger?.debug('remote destroyed');
      this.$dead.next();
      return;
    }

    this.logger?.debug(
      'connecting locally to %s://%s:%d',
      this.localProtocol,
      this.localHost,
      this.opts.localPort
    );
    remote.pause();

    if (this.opts.allowInvalidCert) {
      this.logger?.debug('allowing invalid certificates');
    }

    // connection to local http server
    const local = this.opts.localHttps
      ? tls.connect({
          host: this.localHost,
          port: this.opts.localPort,
          ...this.getLocalCertOpts(),
        })
      : net.connect(this.opts.localPort, this.localHost);

    const remoteClose = () => {
      this.logger?.debug('remote close');
      this.$dead.next();
      local.end();
    };

    remote.once('close', remoteClose);

    // TODO some languages have single threaded servers which makes opening up
    // multiple local connections impossible. We need a smarter way to scale
    // and adjust for such instances to avoid beating on the door of the server
    local.once('error', (err) => {
      this.logger?.debug('local error %s', err.message);
      local.end();

      remote.removeListener('close', remoteClose);

      if (err.code !== 'ECONNREFUSED') {
        remote.end();
        return;
      }

      // retrying connection to local server
      setTimeout(this.connLocal, 1000);
    });

    local.once('connect', () => {
      this.logger?.debug('connected locally');
      remote.resume();

      let stream: Readable = remote;

      // if user requested specific local host
      // then we use host header transform to replace the host header
      if (this.opts.localHost) {
        this.logger?.debug('transform Host header to %s', this.opts.localHost);
        stream = remote.pipe(
          new HeaderHostTransformer({ host: this.opts.localHost })
        );
      }

      stream.pipe(local).pipe(remote);

      // when local closes, also get a new remote
      local.once('close', (hadError) => {
        this.logger?.debug('local connection closed [%s]', hadError);
      });
    });
  };

  private getLocalCertOpts = () => {
    if (this.opts.allowInvalidCert) {
      return { rejectUnauthorized: false };
    }

    if (!this.opts.localCert) {
      throw new Error('local-cert is required');
    }

    if (!this.opts.localKey) {
      throw new Error('local-key is required');
    }

    return {
      cert: fs.readFileSync(this.opts.localCert),
      key: fs.readFileSync(this.opts.localKey),
      ca: this.opts.localCa ? [fs.readFileSync(this.opts.localCa)] : undefined,
    };
  };
}
