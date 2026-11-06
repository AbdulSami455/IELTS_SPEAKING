"""Load a repository-local ``.env`` without walking into parent directories."""

from __future__ import annotations

import os
from pathlib import Path


def load_local_env(start: Path | None = None) -> Path | None:
    """Apply the first ``.env`` between *start* and the repository root.

    Stops at the directory that contains ``pyproject.toml``, ``apps/``, and
    ``packages/``. A ``.env`` in the home directory or any parent of the repo
    is never loaded. Existing process environment always wins.
    """
    current = (start or Path.cwd()).resolve()
    if current.is_file():
        current = current.parent
    for _ in range(16):
        env_path = current / ".env"
        if env_path.is_file():
            apply_env_file(env_path)
            return env_path
        if _is_repo_root(current):
            return None
        parent = current.parent
        if parent == current:
            return None
        current = parent
    return None


def _is_repo_root(path: Path) -> bool:
    return (path / "pyproject.toml").is_file() and (path / "apps").is_dir() and (path / "packages").is_dir()


def apply_env_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8-sig")
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        if key.lower().startswith("export "):
            key = key[7:].strip()
        if not key:
            continue
        os.environ.setdefault(key, _unquote(value.strip()))


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value
