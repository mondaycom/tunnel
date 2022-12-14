# Monday.com Tunnel Server

Monday Tunnel exposes your localhost to the world for easy testing and sharing! No need to mess with DNS or deploy just to have others test out your changes.

This package is the server component. If you are just looking for the CLI tunnel app, see (https://github.com/mondaycom/tunnel).

## Overview

The default localtunnel client connects to the `tunnel.monday.app` server. You can, however, easily set up and run your own server. In order to run your own tunnel server you must ensure that your server can meet the following requirements:

- You can set up DNS entries for your `domain.tld` and `*.domain.tld` (or `sub.domain.tld` and `*.sub.domain.tld`).
- The server can accept incoming TCP connections for any non-root TCP port (i.e. ports over 1000).

The above are important as the client will ask the server for a subdomain under a particular domain. The server will listen on any OS-assigned TCP port for client connections.

## Setup

```shell
npm install 

# server set to run on port 1234
mtunnel-server --port 1234
```

The localtunnel server is now running and waiting for client requests on port 1234. You will most likely want to set up a reverse proxy to listen on port 80 (or start localtunnel on port 80 directly).

**NOTE** By default, localtunnel will use subdomains for clients, if you plan to host your localtunnel server itself on a subdomain you will need to use the _--domain_ option and specify the domain name behind which you are hosting localtunnel. (i.e. my-tunnel-server.example.com)

## Usage

You can now use your domain with the `--host` flag for the `mtunnel` client.

```shell
mtunnel-server --host http://sub.example.tld:1234 --port 9000
```

You will be assigned a URL similar to `heavy-puma-9.sub.example.com:1234`.

If your server is acting as a reverse proxy (i.e. nginx) and is able to listen on port 80, then you do not need the `:1234` part of the hostname for the `mtunnel` client.

## REST API

## POST /api/tunnels

Create a new tunnel with randomly selected name.

## POST /api/tunnels/{id}

Create a new tunnel with your own subdomain (id). If that subdomain is already in use it will generate a random one.

## GET /api/tunnels/{id}/status

Get number of connected sockets for a specific tunnel.

## GET /api/status

General server information (number of tunnels, memory & CPU stats).

## Deploy

You can deploy your own localtunnel server using the prebuilt docker image.

**Note** This assumes that you have a proxy in front of the server to handle the http(s) requests and forward them to the localtunnel server on port 3000. You can use our [localtunnel-nginx](https://github.com/localtunnel/nginx) to accomplish this.
