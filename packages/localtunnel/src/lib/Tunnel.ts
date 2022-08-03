import { parse } from 'node:url';
import axios from 'axios';

import { TunnelRequestInfo, TunnelCluster } from './TunnelCluster';
import { NewClientResponse } from '@mondaydotcomorg/localtunnel-common';
import { filter, first, retry, skipWhile } from 'rxjs/operators';
import { BehaviorSubject, lastValueFrom, from, range, Subject } from 'rxjs';
import { Logger } from 'pino';

export interface TunnelOptions {
  subdomain?: string;
  host: string;
  localHost?: string;
  port: number;
  localPort?: number;
  localHttps?: boolean;
  localCert?: string;
  localCa?: string;
  localKey?: string;
  allowInvalidCert?: boolean;
  maxConnCount?: number;
  logger?: Logger;
}

export interface TunnelInfo {
  clientId: string;
  url: string;
  maxConnCount: number;
  remoteHost?: string;
  remoteIp?: string;
  remotePort: number;
  localHost?: string;
  localPort: number;
  localHttps?: boolean;
  localCert?: string;
  localCa?: string;
  localKey?: string;
  allowInvalidCert?: boolean;
}

export class Tunnel {
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
      throw new Error("localtunnel server didn't return any information");
    }

    this.establish(info);

    return info;
  }

  close() {
    this.$close.next(true);
  }

  private getInfo(body: NewClientResponse): TunnelInfo {
    const { id, ip, port, url, maxConnCount } = body;
    const {
      host,
      port: localPort,
      localHost,
      localHttps,
      localCert,
      localKey,
      localCa,
      allowInvalidCert,
    } = this.opts;

    return {
      clientId: id,
      url,
      maxConnCount: maxConnCount || 1,
      remoteHost: parse(host).hostname ?? undefined,
      remoteIp: ip,
      remotePort: port,
      localPort,
      localHost,
      localHttps,
      localCert,
      localKey,
      localCa,
      allowInvalidCert,
    };
  }

  // initialize connection
  // callback with connection info
  private async init() {
    const opt = this.opts;

    const baseUri = `${opt.host}/`;
    // no subdomain at first, maybe use requested domain
    const assignedDomain = opt.subdomain;
    // where to quest
    const uri = baseUri + (assignedDomain || '?new');
    const logger = this.logger;

    logger?.debug('retrieving tunnel information from %s', uri);
    const res = await axios.get(uri, {
      responseType: 'json',
    });
    const body = res.data;
    logger?.debug('got tunnel information: %o', res.data);
    if (res.status !== 200) {
      throw new Error(
        (body && body.message) ||
          'localtunnel server returned an error, please try again'
      );
    }
    this.info = this.getInfo(body);
    return this.info;
  }

  private async establish(info: TunnelInfo) {
    this.tunnelCluster = new TunnelCluster(info);

    // re-emit socket error
    this.tunnelCluster.$error.subscribe((err) => {
      this.logger?.debug('got socket error: %s', err.message);
      this.$error.next(err);
    });

    let tunnelCount = 0;

    // track open count
    this.tunnelCluster.$open.subscribe((tunnel) => {
      tunnelCount++;
      this.logger?.debug('tunnel open [total: %d]', tunnelCount);

      const closeSub = this.$close
        .pipe(
          skipWhile((x) => !x),
          first()
        )
        .subscribe(() => tunnel.destroy());

      tunnel.once('close', () => {
        closeSub.unsubscribe();
      });
    });

    // when a tunnel dies, open a new one
    this.tunnelCluster.$dead.subscribe(() => {
      tunnelCount--;
      this.logger?.debug('tunnel dead [total: %d]', tunnelCount);
      this.$close
        .pipe(
          first(),
          filter((x) => !x)
        )
        .subscribe(() => {
          this.tunnelCluster?.open();
        });
    });

    this.tunnelCluster.$request.subscribe((req) => {
      this.$request.next(req);
    });

    range(0, info.maxConnCount).subscribe(() => {
      this.tunnelCluster?.open();
    });

    // only emit the url the first time
    await lastValueFrom(this.tunnelCluster.$open);
  }
}
