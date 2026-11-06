# Container images (GHCR)

CI already **builds** both images on every push (no push to a registry).
To publish:

1. Create a tag `v0.1.0` (or run the workflow by hand).
2. [`.github/workflows/publish-images.yml`](../../.github/workflows/publish-images.yml)
   pushes:
   - `ghcr.io/<owner>/ielts-speaking-api`
   - `ghcr.io/<owner>/ielts-speaking-web`

Packages are private until you change their visibility. Kubernetes
[kustomization.yaml](k8s/kustomization.yaml) points at these names.

```sh
git tag v0.1.0
git push origin v0.1.0
```

Pull (after `docker login ghcr.io`):

```sh
docker pull ghcr.io/<owner>/ielts-speaking-api:v0.1.0
docker pull ghcr.io/<owner>/ielts-speaking-web:v0.1.0
```

This does **not** deploy. Point Railway / Fly / your cluster at the new tag
yourself. There is no auto-deploy to production from this repository.
