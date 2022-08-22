---
sidebar_position: 3
---

# REST API

## POST /api/tunnels

Create a new tunnel with randomly selected name.

## POST /api/tunnels/{id}

Create a new tunnel with your own subdomain (id). If that subdomain is already in use it will generate a random one.

## GET /api/tunnels/{id}/status

Get number of connected sockets for a specific tunnel.

## GET /api/status

General server information (number of tunnels, memory & CPU stats).
