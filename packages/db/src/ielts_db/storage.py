"""Private MinIO object storage helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlparse, urlunparse

from minio import Minio
from minio.error import S3Error

from ielts_config import EnvironmentConfig


@dataclass(frozen=True)
class ObjectHead:
    exists: bool
    size_bytes: int
    etag: str | None
    content_type: str | None


class ObjectStore:
    def __init__(self, config: EnvironmentConfig) -> None:
        parsed = urlparse(config.minio_endpoint)
        self._client = Minio(
            parsed.netloc or parsed.path,
            access_key=config.minio_access_key,
            secret_key=config.minio_secret_key,
            secure=parsed.scheme == "https",
            region=config.minio_region,
        )
        self._ttl = config.minio_signed_url_ttl_seconds
        self._public_endpoint = (config.minio_public_endpoint or "").rstrip("/")
        self.candidate_bucket = config.minio_candidate_bucket
        self.examiner_bucket = config.minio_examiner_bucket
        self.derivative_bucket = config.minio_derivative_bucket

    def ensure_buckets(self) -> None:
        for bucket in (self.candidate_bucket, self.examiner_bucket, self.derivative_bucket):
            if not self._client.bucket_exists(bucket):
                self._client.make_bucket(bucket)

    def presigned_put(self, bucket: str, object_key: str) -> str:
        return self._public_url(
            self._client.presigned_put_object(bucket, object_key, expires=timedelta(seconds=self._ttl))
        )

    def presigned_get(self, bucket: str, object_key: str) -> str:
        return self._public_url(
            self._client.presigned_get_object(bucket, object_key, expires=timedelta(seconds=self._ttl))
        )

    def _public_url(self, url: str) -> str:
        if not self._public_endpoint:
            return url
        src = urlparse(url)
        dst = urlparse(self._public_endpoint)
        return urlunparse(
            (dst.scheme or src.scheme, dst.netloc, src.path, src.params, src.query, src.fragment)
        )

    def head(self, bucket: str, object_key: str) -> ObjectHead:
        try:
            info = self._client.stat_object(bucket, object_key)
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

    def get_bytes(self, bucket: str, object_key: str) -> bytes:
        response = self._client.get_object(bucket, object_key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def delete(self, bucket: str, object_key: str) -> None:
        self._client.remove_object(bucket, object_key)

    def put_bytes(self, bucket: str, object_key: str, data: bytes, content_type: str) -> None:
        from io import BytesIO

        self._client.put_object(
            bucket,
            object_key,
            BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
