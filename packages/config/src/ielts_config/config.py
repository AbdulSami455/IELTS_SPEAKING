"""Runtime configuration from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class EnvironmentConfig:
    app_env: str
    web_origin: str
    api_host: str
    api_port: int
    auth_mode: str
    dev_auth_user_id: str
    auth_token_secret: str
    auth_jwt_issuer: str
    auth_jwt_audience: str
    inference_mode: str
    database_url: str
    redis_url: str
    celery_broker_url: str
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_region: str
    minio_candidate_bucket: str
    minio_derivative_bucket: str
    minio_examiner_bucket: str
    minio_force_path_style: bool
    minio_signed_url_ttl_seconds: int
    openrouter_api_key: str
    openrouter_base_url: str
    openrouter_stt_model: str
    openrouter_stt_fallback_model: str
    openrouter_tts_model: str
    openrouter_tts_voice: str
    openrouter_scoring_model: str
    openrouter_scoring_fallback_model: str
    openrouter_pronunciation_model: str
    raw_audio_retention_days: int
    transcript_retention_days: int
    report_retention_days: int
    upload_max_bytes_per_answer: int
    upload_max_bytes_per_test: int
    log_level: str
    free_request_daily_hard_limit: int
    free_request_daily_soft_limit: int
    paid_daily_budget_usd: float
    paid_test_cost_ceiling_usd: float
    consent_version: str = "2026-08-18"
    minio_public_endpoint: str = ""

    @classmethod
    def from_env(cls) -> EnvironmentConfig:
        def _int(name: str, default: int) -> int:
            raw = os.environ.get(name)
            if raw is None:
                return default
            return int(raw)

        def _float(name: str, default: float) -> float:
            raw = os.environ.get(name)
            if raw is None:
                return default
            return float(raw)

        def _str(name: str, default: str) -> str:
            return os.environ.get(name, default)

        def _bool(name: str, default: bool) -> bool:
            raw = os.environ.get(name)
            if raw is None:
                return default
            return raw.lower() in {"1", "true", "yes"}

        return cls(
            app_env=_str("APP_ENV", "development"),
            web_origin=_str("WEB_ORIGIN", "http://localhost:3000"),
            api_host=_str("API_HOST", "0.0.0.0"),
            api_port=_int("API_PORT", 4000),
            auth_mode=_str("AUTH_MODE", "dev"),
            dev_auth_user_id=_str("DEV_AUTH_USER_ID", "00000000-0000-4000-8000-000000000001"),
            auth_token_secret=_str("AUTH_TOKEN_SECRET", "")
            or (
                "development-jwt-secret-please-change-32"
                if _str("APP_ENV", "development").lower() != "production"
                else ""
            ),
            auth_jwt_issuer=_str("AUTH_JWT_ISSUER", ""),
            auth_jwt_audience=_str("AUTH_JWT_AUDIENCE", ""),
            inference_mode=_str("INFERENCE_MODE", "openrouter"),
            database_url=_str("DATABASE_URL", ""),
            redis_url=_str("REDIS_URL", ""),
            celery_broker_url=_str("CELERY_BROKER_URL", "redis://localhost:6379/1"),
            minio_endpoint=_str("MINIO_ENDPOINT", "http://localhost:9000"),
            minio_access_key=_str("MINIO_ACCESS_KEY", ""),
            minio_secret_key=_str("MINIO_SECRET_KEY", ""),
            minio_region=_str("MINIO_REGION", "us-east-1"),
            minio_candidate_bucket=_str("MINIO_CANDIDATE_BUCKET", "ielts-candidate-private"),
            minio_derivative_bucket=_str("MINIO_DERIVATIVE_BUCKET", "ielts-derived-private"),
            minio_examiner_bucket=_str("MINIO_EXAMINER_BUCKET", "ielts-examiner-private"),
            minio_force_path_style=_bool("MINIO_FORCE_PATH_STYLE", True),
            minio_signed_url_ttl_seconds=_int("MINIO_SIGNED_URL_TTL_SECONDS", 900),
            openrouter_api_key=_str("OPENROUTER_API_KEY", ""),
            openrouter_base_url=_str("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
            openrouter_stt_model=_str("OPENROUTER_STT_MODEL", "openai/whisper-large-v3-turbo"),
            openrouter_stt_fallback_model=_str("OPENROUTER_STT_FALLBACK_MODEL", "openai/whisper-large-v3"),
            openrouter_tts_model=_str("OPENROUTER_TTS_MODEL", "openai/gpt-4o-mini-tts"),
            openrouter_tts_voice=_str("OPENROUTER_TTS_VOICE", "alloy"),
            openrouter_scoring_model=_str("OPENROUTER_SCORING_MODEL", "google/gemma-3-27b-it:free"),
            openrouter_scoring_fallback_model=_str("OPENROUTER_SCORING_FALLBACK_MODEL", "google/gemma-3-27b-it"),
            openrouter_pronunciation_model=_str("OPENROUTER_PRONUNCIATION_MODEL", "google/gemma-3-27b-it:free"),
            raw_audio_retention_days=_int("RAW_AUDIO_RETENTION_DAYS", 7),
            transcript_retention_days=_int("TRANSCRIPT_RETENTION_DAYS", 30),
            report_retention_days=_int("REPORT_RETENTION_DAYS", 365),
            upload_max_bytes_per_answer=_int("UPLOAD_MAX_BYTES_PER_ANSWER", 26214400),
            upload_max_bytes_per_test=_int("UPLOAD_MAX_BYTES_PER_TEST", 104857600),
            log_level=_str("LOG_LEVEL", "info"),
            free_request_daily_hard_limit=_int("FREE_REQUEST_DAILY_HARD_LIMIT", 1000),
            free_request_daily_soft_limit=_int("FREE_REQUEST_DAILY_SOFT_LIMIT", 800),
            paid_daily_budget_usd=_float("PAID_DAILY_BUDGET_USD", 5.0),
            paid_test_cost_ceiling_usd=_float("PAID_TEST_COST_CEILING_USD", 0.035),
            minio_public_endpoint=_str("MINIO_PUBLIC_ENDPOINT", ""),
        )

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    def validate(self) -> list[str]:
        errors: list[str] = []
        if not self.database_url:
            errors.append("DATABASE_URL is required")
        if not self.redis_url:
            errors.append("REDIS_URL is required")
        if not self.minio_endpoint:
            errors.append("MINIO_ENDPOINT is required")
        if not self.minio_access_key:
            errors.append("MINIO_ACCESS_KEY is required")
        if not self.minio_secret_key:
            errors.append("MINIO_SECRET_KEY is required")
        if self.is_production:
            if self.auth_mode == "dev":
                errors.append("AUTH_MODE=dev is forbidden in production")
            if self.inference_mode == "fake":
                errors.append("INFERENCE_MODE=fake is forbidden in production")
            if not self.openrouter_api_key:
                errors.append("OPENROUTER_API_KEY is required in production")
            if self.minio_secret_key in {"minio-development-only", "", "changeme"}:
                errors.append("MINIO_SECRET_KEY is a development placeholder")
            if not self.auth_token_secret or self.auth_token_secret in {"changeme", "development-only"}:
                errors.append("AUTH_TOKEN_SECRET is required in production")
            if len(self.auth_token_secret) < 32:
                errors.append("AUTH_TOKEN_SECRET must be at least 32 characters in production")
            if self.web_origin.startswith("http://localhost"):
                errors.append("WEB_ORIGIN must not be localhost in production")
        if self.free_request_daily_hard_limit > 1000:
            errors.append("FREE_REQUEST_DAILY_HARD_LIMIT cannot exceed 1000")
        if self.paid_test_cost_ceiling_usd > 0.035:
            errors.append("PAID_TEST_COST_CEILING_USD cannot exceed $0.035")
        if self.upload_max_bytes_per_answer > 26214400:
            errors.append("UPLOAD_MAX_BYTES_PER_ANSWER cannot exceed 25 MiB")
        if self.upload_max_bytes_per_test > 104857600:
            errors.append("UPLOAD_MAX_BYTES_PER_TEST cannot exceed 100 MiB")
        return errors

    def validate_or_raise(self) -> None:
        errors = self.validate()
        if errors:
            raise ValueError("Configuration validation failed:\n  - " + "\n  - ".join(errors))


@lru_cache(maxsize=1)
def get_config() -> EnvironmentConfig:
    config = EnvironmentConfig.from_env()
    config.validate_or_raise()
    return config
