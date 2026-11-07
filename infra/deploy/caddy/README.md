# Caddy in front of Compose

TLS belongs at the edge. This overlay adds Caddy to
[`docker-compose.prod.yml`](../../../docker-compose.prod.yml) so you do not
have to invent a reverse proxy.

```sh
# .env already has APP_ENV=production and secrets. Add:
#   DOMAIN=speak.example.com
#   ACME_EMAIL=you@example.com
#   WEB_ORIGIN=https://speak.example.com
#   TRUSTED_PROXY_HOPS=1

docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml up -d --build
```

Caddy obtains a Let's Encrypt certificate for `DOMAIN` and reverse-proxies to
`web:8080` (HTTP + WebSocket, 180s timeouts to match the speaking room).

Point DNS at the VPS before the first start. Ports **80** and **443** must be
free. Host port **8080** from the prod file is still published for debugging;
learners should use `https://$DOMAIN`.

Replace Caddy with Traefik, Cloudflare, or a host nginx if you already have
one — keep `TRUSTED_PROXY_HOPS` equal to the number of hops that add
`X-Forwarded-For`.
