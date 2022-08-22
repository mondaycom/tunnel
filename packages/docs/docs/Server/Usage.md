---
sidebar_position: 2
---

# Usage

You can now use your domain with the `--host` flag for the `mtunnel` client.

```shell
mtunnel-server --host http://sub.example.tld:1234 --port 9000
```

You will be assigned a URL similar to `heavy-puma-9.sub.example.com:1234`.

If your server is acting as a reverse proxy (i.e. nginx) and is able to listen on port 80, then you do not need the `:1234` part of the hostname for the `mtunnel` client.
