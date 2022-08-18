import { TunnelConnection } from './TunnelConnection';
import { TunnelOptions } from './types';

export type TunnelCallback = (
  err: Error | null,
  connection: TunnelConnection | null
) => void;

async function createTunnel(options: TunnelOptions): Promise<TunnelConnection> {
  const client = new TunnelConnection(options);
  await client.open();
  return client;
}

export default createTunnel;
