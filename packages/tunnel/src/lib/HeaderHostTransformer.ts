import { Transform, TransformCallback, TransformOptions } from 'node:stream';

export interface HeaderHostTransformerOpts extends TransformOptions {
  host?: string;
}

export class HeaderHostTransformer extends Transform {
  host: string;
  replaced = false;

  constructor(opts: HeaderHostTransformerOpts = {}) {
    super(opts);
    this.host = opts.host || 'localhost';
  }

  override _transform(
    data: unknown,
    _encoding: BufferEncoding,
    callback: TransformCallback
  ) {
    callback(
      null,
      this.replaced // after replacing the first instance of the Host header we just become a regular passthrough
        ? data
        : String(data).replace(/(\r\n[Hh]ost: )\S+/, (match, $1) => {
            this.replaced = true;
            return $1 + this.host;
          })
    );
  }
}
