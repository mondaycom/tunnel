import { parse } from 'node:url';
import axios from 'axios';

import { TunnelCluster, TunnelRequestInfo } from './TunnelCluster';
import { NewClientResponse } from '@mondaydotcomorg/tunnel-common';
import { filter, first, mergeMap, retry, skipWhile } from 'rxjs/operators';
import { BehaviorSubject, Subject, from, lastValueFrom, range } from 'rxjs';
import { Logger } from 'pino';
import { TunnelInfo, TunnelOptions } from './types';

export class TunnelConnection {
  tunnelCluster?: TunnelCluster;
  info?: TunnelInfo;

  $open = new Subject<string>();
  $error = new Subject<Error>();
  $close = new BehaviorSubject<boolean>(false);
  $request = new Subject<TunnelRequestInfo>();
  logger?: Logger;

  constructor(readonly opts: TunnelOptions) {
    this.logger = opts.logger;
  }

  async open(): Promise<TunnelInfo> {
    const info = await lastValueFrom(
      from(this.init()).pipe(retry({ delay: 1000 }))
    );

    if (!info) {
      throw new Error("tunnel server didn't return any information");
    }

    this.establish(info);

    return info;
  }

  close() {
    this.$close.next(true);
  }

  private getInfo(body: NewClientResponse): TunnelInfo {
    const { id, ip, port, url, maxConnCount } = body;
    const { host, port: localPort, localHost } = this.opts;

    return {
      clientId: id,
      url,
      maxConnCount: maxConnCount || 1,
      remoteHost: new URL(host).hostname ?? undefined,
      remoteIp: ip,
      remotePort: port,
      localPort,
      localHost,
    };
  }

  // initialize connection
  // callback with connection info
  private async init() {
    const opt = this.opts;
    const logger = this.logger;

    const uri = opt.subdomain
      ? `${opt.host}/api/tunnels/${opt.subdomain}`
      : `${opt.host}/api/tunnels`;

    logger?.debug('retrieving tunnel information from %s', uri);
    const res = await axios.post(uri, {
      responseType: 'json',
    });
    const body = res.data;
    logger?.debug('got tunnel information: %o', res.data);
    if (res.status !== 200) {
      throw new Error(
        (body && body.message) ||
          'tunnel server returned an error, please try again'
      );
    }
    this.info = this.getInfo(body);
    return this.info;
  }

  private async establish(info: TunnelInfo) {
    const tunnelCluster = (this.tunnelCluster = new TunnelCluster({
      ...info,
      logger: this.logger,
    }));

    // re-emit socket error
    tunnelCluster.$error.subscribe((err) => {
      this.logger?.debug('got socket error: %s', err.message);
      this.$error.next(err);
    });

    let tunnelCount = 0;

    // track open count
    tunnelCluster.$open.subscribe(({ socket, tunnelId }) => {
      tunnelCount++;
      this.logger?.debug({ tunnelId }, 'tunnel open [total: %d]', tunnelCount);

      const closeSub = this.$close
        .pipe(
          skipWhile((x) => !x),
          first()
        )
        .subscribe(() => socket.destroy());

      socket.once('close', () => {
        closeSub.unsubscribe();
      });
    });

    // when a tunnel dies, open a new one
    tunnelCluster.$dead.subscribe(({ tunnelId }) => {
      tunnelCount--;
      this.logger?.debug({ tunnelId }, 'tunnel dead [total: %d]', tunnelCount);
      this.$close
        .pipe(
          first(),
          filter((x) => !x)
        )
        .subscribe(() => {
          this.tunnelCluster?.open();
        });
    });

    tunnelCluster.$request.subscribe((req) => {
      this.$request.next(req);
    });

    await lastValueFrom(
      range(0, info.maxConnCount).pipe(
        mergeMap(() => from(tunnelCluster.open()))
      )
    );
  }
}
