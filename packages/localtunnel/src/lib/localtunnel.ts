import { TunnelConnection, TunnelOptions } from './TunnelConnection';

export type TunnelCallback = (err: Error | null, tunnel: TunnelConnection | null) => void;

async function localtunnel(options: TunnelOptions): Promise<TunnelConnection> {
  const client = new TunnelConnection(options);
  await client.open();
  return client;
}

export default localtunnel;
