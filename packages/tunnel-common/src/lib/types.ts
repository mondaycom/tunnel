export interface NewClientResult {
  id: string;
  port: number;
  maxConnCount: number | undefined;
}

export interface NewClientResponse extends NewClientResult {
  url: string;
  ip?: string;
}
