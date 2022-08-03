import { Tunnel, TunnelOptions } from './Tunnel';

export type TunnelCallback = (err: Error | null, tunnel: Tunnel | null) => void;

async function localtunnel(options: TunnelOptions): Promise<Tunnel> {
  const client = new Tunnel(options);
  await client.open();
  return client;
}

export default localtunnel;
