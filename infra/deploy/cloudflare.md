# Cloudflare Tunnel (no open 80/443)

Use this when the VPS should not listen on the public internet. Run
[`docker-compose.prod.yml`](../../docker-compose.prod.yml) as usual (web on
host `8080`, or only on the Compose network) and put a [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
tunnel in front.

```sh
# On the VPS, after the Compose stack is healthy:
cloudflared tunnel login
cloudflared tunnel create ielts
cloudflared tunnel route dns ielts speak.example.com
```

Config (`/etc/cloudflared/config.yml`):

```yaml
tunnel: <tunnel-id>
credentials-file: /etc/cloudflared/<tunnel-id>.json
ingress:
  - hostname: speak.example.com
    service: http://127.0.0.1:8080
    originRequest:
      connectTimeout: 30s
      # Speaking-room websocket
      noHappyEyeballs: true
  - service: http_status:404
```

Then:

```sh
sudo cloudflared service install
```

Set on api / worker / beat:

```
WEB_ORIGIN=https://speak.example.com
TRUSTED_PROXY_HOPS=1
```

Cloudflare is the TLS terminator. Do not also put Caddy on 443 on the same
host unless you know why.

WAF / bot fight can break the microphone WebSocket. If the room connects and
then dies, skip Bot Fight Mode for this hostname and allow `wss://`.
