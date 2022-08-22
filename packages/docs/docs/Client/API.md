---
sidebar_position: 4
---

# API

The tunnel client is also usable through an API (for test integration, automation, etc)

## createTunnel(port [,options][,callback])

Creates a new tunnel to the specified local `port`. Will return a Promise that resolves once you have been assigned a public tunnel url. `options` can be used to request a specific `subdomain`. A `callback` function can be passed, in which case it won't return a Promise. This exists for backwards compatibility with the old Node-style callback API. You may also pass a single options object with `port` as a property.

```js
import createTunnel from '@mondaydotcomorg/tunnel';

(async () => {
  const tunnel = await createTunnel({ port: 3000 });

  // the assigned public url for your tunnel
  // i.e. https://beautiful-cherry-21.tunnel.monday.app
  console.log(tunnel.url);

  tunnel.$close.subscribe(() => {
    // tunnels are closed
  });
})();
```

### options

- `port` (number) [required] The local port number to expose through tunnel.
- `subdomain` (string) Request a specific subdomain on the proxy server. **Note** You may not actually receive this name depending on availability.
- `host` (string) URL for the upstream proxy server. Defaults to `https://tunnel.monday.app`.
- `local_host` (string) Proxy to this hostname instead of `localhost`. This will also cause the `Host` header to be re-written to this value in proxied requests.
- `local_https` (boolean) Enable tunneling to local HTTPS server.
- `local_cert` (string) Path to certificate PEM file for local HTTPS server.
- `local_key` (string) Path to certificate key file for local HTTPS server.
- `local_ca` (string) Path to certificate authority file for self-signed certificates.
- `allow_invalid_cert` (boolean) Disable certificate checks for your local HTTPS server (ignore cert/key/ca options).

Refer to [tls.createSecureContext](https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options) for details on the certificate options.

## Tunnel

The `tunnel` instance has the following observables:

| observable | args | description                                                                          |
| ---------- | ---- | ------------------------------------------------------------------------------------ |
| $request   | info | fires when a request is processed by the tunnel, contains _method_ and _path_ fields |
| $error     | err  | fires when an error happens on the tunnel                                            |
| $close     |      | fires when the tunnel has closed                                                     |

The `tunnel` instance has the following methods

| method | args | description      |
| ------ | ---- | ---------------- |
| close  |      | close the tunnel |
