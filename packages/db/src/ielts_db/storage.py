"""Private MinIO object storage helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlparse

try:
    from minio import Minio
    from minio.error import S3Error
except ModuleNotFoundError:
    Minio = None

    class S3Error(Exception):
        code = "MINIO_UNAVAILABLE"

from ielts_config import EnvironmentConfig


@dataclass(frozen=True)
class ObjectHead:
    exists: bool
    size_bytes: int
    etag: str | None
    content_type: str | None


class ObjectStore:
    def __init__(self, config: EnvironmentConfig) -> None:
        self._client: Any = None
        self._public_client: Any = None
        self._public_base = ""
        self._ttl = config.minio_signed_url_ttl_seconds
        self.candidate_bucket = config.minio_candidate_bucket
        self.examiner_bucket = config.minio_examiner_bucket
        self.derivative_bucket = config.minio_derivative_bucket
        if Minio is None:
            return
        parsed = urlparse(config.minio_endpoint)
        self._client = Minio(
            parsed.netloc or parsed.path,
            access_key=config.minio_access_key,
            secret_key=config.minio_secret_key,
            secure=parsed.scheme == "https",
            region=config.minio_region,
        )
        self._public_client = self._client
        public_endpoint = (config.minio_public_endpoint or "").rstrip("/")
        self._public_base = (public_endpoint or config.minio_endpoint).rstrip("/")
        if public_endpoint:
            public = urlparse(public_endpoint)
            self._public_client = Minio(
                public.netloc or public.path,
                access_key=config.minio_access_key,
                secret_key=config.minio_secret_key,
                secure=public.scheme == "https",
                region=config.minio_region,
            )
    def _require_client(self) -> Any:
        if self._client is None or self._public_client is None:
            raise RuntimeError("MinIO client dependency is not installed")
        return self._client

    def ensure_buckets(self) -> None:
        client = self._require_client()
        for bucket in (self.candidate_bucket, self.examiner_bucket, self.derivative_bucket):
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)

    def bucket_exists(self, bucket: str) -> bool:
        return bool(self._require_client().bucket_exists(bucket))

    def list_keys(self, bucket: str, prefix: str) -> list[str]:
        client = self._require_client()
        return [item.object_name for item in client.list_objects(bucket, prefix=prefix, recursive=True)]

    def delete_prefix(self, bucket: str, prefix: str) -> int:
        """Remove every object under a prefix; returns how many were deleted."""
        keys = self.list_keys(bucket, prefix)
        for key in keys:
            self.delete(bucket, key)
        return len(keys)

    def presigned_put(self, bucket: str, object_key: str) -> str:
        self._require_client()
        return self._public_client.presigned_put_object(bucket, object_key, expires=timedelta(seconds=self._ttl))

    def presigned_post(self, bucket: str, object_key: str, max_bytes: int, content_type: str) -> tuple[str, dict[str, str]]:
        """Return a form-upload URL and fields that storage itself limits to ``max_bytes``.

        Unlike a presigned PUT, the signed policy pins the key, the content type, and a
        1..max_bytes length range, so an oversized upload is refused before it is stored.
        """
        from minio.datatypes import PostPolicy

        self._require_client()
        policy = PostPolicy(bucket, datetime.now(UTC) + timedelta(seconds=self._ttl))
        policy.add_equals_condition("key", object_key)
        policy.add_equals_condition("Content-Type", content_type)
        policy.add_content_length_range_condition(1, max_bytes)
        fields = self._public_client.presigned_post_policy(policy)
        # The signed policy pins these two values; the client must echo them as form fields.
        return f"{self._public_base}/{bucket}", {**fields, "key": object_key, "Content-Type": content_type}

    def presigned_get(self, bucket: str, object_key: str) -> str:
        self._require_client()
        return self._public_client.presigned_get_object(bucket, object_key, expires=timedelta(seconds=self._ttl))

    def head(self, bucket: str, object_key: str) -> ObjectHead:
        client = self._require_client()
        try:
            info = client.stat_object(bucket, object_key)
        except S3Error as exc:
            if exc.code in {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}:
                return ObjectHead(False, 0, None, None)
            raise
        return ObjectHead(
            exists=True,
            size_bytes=info.size or 0,
            etag=info.etag,
            content_type=info.content_type,
        )

    def get_bytes(self, bucket: str, object_key: str, max_bytes: int | None = None) -> bytes:
        """Read an object. With ``max_bytes`` set, refuse anything larger instead of loading it.

        Uploads are size-limited by the signed POST policy, but callers that read learner
        uploads still pass the configured limit as defence in depth.
        """
        client = self._require_client()
        response = client.get_object(bucket, object_key)
        try:
            data = response.read() if max_bytes is None else response.read(max_bytes + 1)
            if max_bytes is not None and len(data) > max_bytes:
                raise ValueError(f"Object exceeds the {max_bytes}-byte limit")
            return data
        finally:
            response.close()
            response.release_conn()

    def delete(self, bucket: str, object_key: str) -> None:
        client = self._require_client()
        client.remove_object(bucket, object_key)

    def put_bytes(self, bucket: str, object_key: str, data: bytes, content_type: str) -> None:
        from io import BytesIO

        client = self._require_client()
        client.put_object(
            bucket,
            object_key,
            BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
