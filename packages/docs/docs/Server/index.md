# Server

The default localtunnel client connects to the `tunnel.monday.app` server. You can, however, easily set up and run your own server. In order to run your own tunnel server you must ensure that your server can meet the following requirements:

- You can set up DNS entries for your `domain.tld` and `*.domain.tld` (or `sub.domain.tld` and `*.sub.domain.tld`).
- The server can accept incoming TCP connections for any non-root TCP port (i.e. ports over 1000).

The above are important as the client will ask the server for a subdomain under a particular domain. The server will listen on any OS-assigned TCP port for client connections.
