# monday.com Tunnel

Monday.com Tunnel exposes your localhost to the world for easy testing and sharing! No need to mess with DNS or deploy just to test out your changes.

Great for testing mobile apps connected to your locally running backend or running your appexternal services like monday.com which require a public url for callbacks.

## Quickstart

```
npx @mondaydotcomorg/tunnel --port 8000
```

## Installation

### Globally

```
npm install -g @mondaydotcomorg/tunnel
```

### As a dependency in your project

```
yarn add @mondaydotcomorg/tunnel
```

## CLI usage

When tunnel is installed globally, just use the `mtunnel` command to start the tunnel.

```
mtunnel --port 8000
```

Thats it! It will connect to the tunnel server, setup the tunnel, and tell you what url to use for your testing. This url will remain active for the duration of your session; so feel free to share it with others for happy fun time!

You can restart your local server all you want, `mtunnel` is smart enough to detect this and reconnect once it is back.

### Arguments

Below are some common arguments. See `mtunnel --help` for additional arguments

- `--subdomain` request a named subdomain on the tunnel server (default is random characters)
- `--local-host` proxy to a hostname other than localhost

You may also specify arguments via env variables. E.x.

```
PORT=3000 mtunnel
```

## API

The tunnel client is also usable through an API (for test integration, automation, etc)

### tunnel(port [,options][,callback])

Creates a new tunnel to the specified local `port`. Will return a Promise that resolves once you have been assigned a public tunnel url. `options` can be used to request a specific `subdomain`. A `callback` function can be passed, in which case it won't return a Promise. This exists for backwards compatibility with the old Node-style callback API. You may also pass a single options object with `port` as a property.

```js
import createTunnel from '@mondaydotcomorg/tunnel';

(async () => {
  const tunnel = await tunnel({ port: 3000 });

  // the assigned public url for your tunnel
  // i.e. https://abcdefgjhij.tunnel.me
  tunnel.url;

  tunnel.on('close', () => {
    // tunnels are closed
  });
})();
```

#### options

- `port` (number) [required] The local port number to expose through tunnel.
- `subdomain` (string) Request a specific subdomain on the proxy server. **Note** You may not actually receive this name depending on availability.
- `host` (string) URL for the upstream proxy server. Defaults to `https://tunnel.me`.
- `local_host` (string) Proxy to this hostname instead of `localhost`. This will also cause the `Host` header to be re-written to this value in proxied requests.
- `local_https` (boolean) Enable tunneling to local HTTPS server.
- `local_cert` (string) Path to certificate PEM file for local HTTPS server.
- `local_key` (string) Path to certificate key file for local HTTPS server.
- `local_ca` (string) Path to certificate authority file for self-signed certificates.
- `allow_invalid_cert` (boolean) Disable certificate checks for your local HTTPS server (ignore cert/key/ca options).

Refer to [tls.createSecureContext](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options) for details on the certificate options.

### Tunnel

The `tunnel` instance returned to your callback emits the following events

| event   | args | description                                                                          |
| ------- | ---- | ------------------------------------------------------------------------------------ |
| request | info | fires when a request is processed by the tunnel, contains _method_ and _path_ fields |
| error   | err  | fires when an error happens on the tunnel                                            |
| close   |      | fires when the tunnel has closed                                                     |

The `tunnel` instance has the following methods

| method | args | description      |
| ------ | ---- | ---------------- |
| close  |      | close the tunnel |

## other clients

Clients in other languages

_go_ [gotunnelme](https://github.com/NoahShen/gotunnelme)

_go_ [go-tunnel](https://github.com/tunnel/go-tunnel)

_C#/.NET_ [tunnel-client](https://github.com/angelobreuer/tunnel-client)

_Rust_ (rlt)(https://github.com/kaichaosun/rlt)

## server

See [tunnel/server](//github.com/tunnel/server) for details on the server that powers tunnel.

## License

MIT
