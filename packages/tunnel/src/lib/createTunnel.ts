import { TunnelConnection } from './TunnelConnection';
import { TunnelOptions } from './types';

export async function createTunnel(options: TunnelOptions): Promise<TunnelConnection> {
  const client = new TunnelConnection(options);
  await client.open();
  return client;
}

export default createTunnel;
