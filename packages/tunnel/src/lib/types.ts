import { Logger } from "pino";

export interface TunnelOptions {
  subdomain?: string;
  host?: string;
  localHost?: string;
  port: number;
  localPort?: number;
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
}
