---
sidebar_position: 3
---

# CLI usage

When tunnel is installed globally, just use the `mtunnel` command to start the tunnel.

```shell
mtunnel --port 8000
```

Thats it! It will connect to the tunnel server, setup the tunnel, and tell you what url to use for your testing. This url will remain active for the duration of your session; so feel free to share it with others for happy fun time!

You can restart your local server all you want, `mtunnel` is smart enough to detect this and reconnect once it is back.

## Arguments

Below are some common arguments. See `mtunnel --help` for additional arguments

- `--subdomain` request a named subdomain on the tunnel server (default is random characters)
- `--local-host` proxy to a hostname other than localhost

You may also specify arguments via env variables. Ex.:

```shell
TUNNEL_PORT=3000 mtunnel
```

You can use any option from `mtunnel --help` as environment variable, you just have to prefix it with `TUNNEL_`.
