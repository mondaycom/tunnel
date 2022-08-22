# Monday.com Tunnel

Monday.com Tunnel exposes your localhost to the world for easy testing and sharing! No need to mess with DNS or deploy just to have others test out your changes.

Great for testing your app feature directly on monday.com.

## Quickstart

Assuming your app runs on port 8000:

```shell
npx @mondaydotcomorg/tunnel --port 8000
```

In case you want to have your own subdomain:

```shell
npx @mondaydotcomorg/tunnel --port 8000 --subdomain=my-cool-app
```

## Installation

## Globally

```shell
npm install -g @mondaydotcomorg/tunnel
yarn global add @mondaydotcomorg/tunnel
pnpm add -g @mondaydotcomorg/tunnel
```

## As a dependency in your project

```shell
npm install @mondaydotcomorg/tunnel
yarn add @mondaydotcomorg/tunnel
pnpm add @mondaydotcomorg/tunnel
```

## CLI usage

When tunnel is installed globally, just use the `mtunnel` command to start the tunnel.

```shell
mtunnel --port 8000
```

Thats it! It will connect to the server, setup the tunnel, and tell you what url to use for your testing. This url will remain active for the duration of your session; so feel free to share it with others for happy fun time!

You can restart your local server all you want, `mtunnel` is smart enough to detect this and reconnect once it is back.

### Arguments

Below are some common arguments. See `mtunnel --help` for additional arguments

- `--subdomain` request a named subdomain on the tunnel server (default is random characters)
- `--local-host` proxy to a hostname other than localhost

You may also specify arguments via env variables. Ex.:

```shell
TUNNEL_PORT=3000 mtunnel
```

You can use any option from `mtunnel --help` as environment variable, you just have to prefix it with `TUNNEL_`.

## API

The tunnel client is also usable through an API (for test integration, automation, etc)

### createTunnel(port [,options][,callback])

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

#### options

- `port` (number) [required] The local port number to expose through tunnel.
- `subdomain` (string) Request a specific subdomain on the proxy server. **Note** You may not actually receive this name depending on availability.
- `host` (string) URL for the upstream proxy server. Defaults to `https://tunnel.monday.app`.
- `local_host` (string) Proxy to this hostname instead of `localhost`. This will also cause the `Host` header to be re-written to this value in proxied requests.
- `open` (boolean) Opens the tunnel URL in your browser.
- `debug` (boolean) Print more verbose logs (great for diagnosing).
- `print-requests` (boolean) Print basic request info in the console.

#### Tunnel

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
