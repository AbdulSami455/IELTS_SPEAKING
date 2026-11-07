"""Application errors mapped to the API envelope."""

from __future__ import annotations


class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int, retryable: bool = False) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retryable = retryable


def not_found(message: str = "Resource not found") -> AppError:
    return AppError("RESOURCE_NOT_FOUND", message, 404)


def conflict(message: str) -> AppError:
    return AppError("TEST_STATE_CONFLICT", message, 409)


def validation(message: str) -> AppError:
    return AppError("VALIDATION_FAILED", message, 400)


def forbidden(message: str = "This action is not permitted") -> AppError:
    return AppError("FORBIDDEN", message, 403)
