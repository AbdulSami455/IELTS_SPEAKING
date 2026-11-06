# DigitalOcean App Platform

Spec: [app.yaml](app.yaml). Shared rules: [docs/deploy.md](../../../docs/deploy.md).

```sh
doctl apps create --spec infra/deploy/digitalocean/app.yaml
```

Or Apps → Create → upload the spec.

1. Create an S3-compatible bucket (Spaces, R2, Tigris). App Platform does not
   provision object storage.
2. Fill every `type: SECRET` in the dashboard (auth, metrics, OpenRouter,
   `MINIO_*`, `WEB_ORIGIN`).
3. First deploy: the `migrate` PRE_DEPLOY job runs `alembic upgrade head`.
4. Copy the **web** public URL into `WEB_ORIGIN` on api, worker, and beat.
   Redeploy those three.
5. Keep **beat** at one instance.

`API_UPSTREAM=api:4000` matches the api component name and `http_port`.

Health: api `/health/ready`, web `/`. Learners hit **web** only.
