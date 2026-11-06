# Kubernetes (Kustomize)

This base runs the four app processes. **Postgres, Redis, and object storage
are not included** — point `DATABASE_URL`, `REDIS_URL`, `CELERY_BROKER_URL`,
and `MINIO_*` at managed services (CloudNativePG, Memorystore, R2, Tigris,
RDS, ElastiCache, …).

Images are published by [Publish images](../../../.github/workflows/publish-images.yml)
to GHCR. Override the image names in `kustomization.yaml` if you push elsewhere.

## Secret

Create one Opaque secret named `ielts` in namespace `ielts`. Never commit it.

```sh
kubectl create namespace ielts
kubectl -n ielts create secret generic ielts --from-env-file=.env
```

The secret must include at least:

```
AUTH_TOKEN_SECRET
METRICS_TOKEN
WEB_ORIGIN
DATABASE_URL
REDIS_URL
CELERY_BROKER_URL
MINIO_ENDPOINT
MINIO_PUBLIC_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
OPENROUTER_API_KEY
```

Edit [configmap.yaml](configmap.yaml) for non-secret values (`CONSENT_VERSION`,
bucket names, `TRUSTED_PROXY_HOPS`). Edit [ingress.yaml](ingress.yaml), replace
`speak.example.com`, then apply it separately (`kubectl apply -f`).
`WEB_ORIGIN` must be that `https://` origin. Ingress is not in the default
kustomization so a cluster without nginx-ingress still applies cleanly.

## Apply

```sh
# After images exist. Jobs are immutable — delete a previous migrate Job first.
kubectl -n ielts delete job migrate --ignore-not-found
kubectl apply -k infra/deploy/k8s
kubectl -n ielts wait --for=condition=complete job/migrate --timeout=120s
kubectl -n ielts rollout status deploy/api deploy/web deploy/worker deploy/beat
```

Beat is pinned at **one** replica in [beat.yaml](beat.yaml). Do not raise it.

Argo CD: the migrate Job has a `PreSync` hook so migrations run before the
new ReplicaSets. Helm is not provided; wrap this directory if you need values.

## Health

| Process | Probe |
| --- | --- |
| api | `/health/live` (liveness), `/health/ready` (readiness) |
| web | `GET /` |
| worker / beat | none (no HTTP) |
