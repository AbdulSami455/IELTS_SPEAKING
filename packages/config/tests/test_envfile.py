import os
from pathlib import Path

from ielts_config.envfile import load_local_env


def _fake_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / "apps").mkdir(parents=True)
    (repo / "packages").mkdir()
    (repo / "pyproject.toml").write_text("[project]\nname = 'demo'\n", encoding="utf-8")
    return repo


def test_load_local_env_reads_repo_dotenv(tmp_path: Path, monkeypatch):
    repo = _fake_repo(tmp_path)
    (repo / ".env").write_text("DEMO_ENVFILE_KEY=from-repo\n", encoding="utf-8")
    monkeypatch.delenv("DEMO_ENVFILE_KEY", raising=False)
    found = load_local_env(repo / "apps" / "api" / "src")
    assert found == repo / ".env"
    assert os.environ["DEMO_ENVFILE_KEY"] == "from-repo"
    monkeypatch.delenv("DEMO_ENVFILE_KEY", raising=False)


def test_load_local_env_does_not_read_parent_of_repo(tmp_path: Path, monkeypatch):
    repo = _fake_repo(tmp_path)
    (tmp_path / ".env").write_text("LEAKED_PARENT_SECRET=should-not-load\n", encoding="utf-8")
    monkeypatch.delenv("LEAKED_PARENT_SECRET", raising=False)
    found = load_local_env(repo / "apps")
    assert found is None
    assert "LEAKED_PARENT_SECRET" not in os.environ


def test_load_local_env_does_not_override_process_env(tmp_path: Path, monkeypatch):
    repo = _fake_repo(tmp_path)
    (repo / ".env").write_text("DEMO_ENVFILE_KEY=from-file\n", encoding="utf-8")
    monkeypatch.setenv("DEMO_ENVFILE_KEY", "already-set")
    load_local_env(repo)
    assert os.environ["DEMO_ENVFILE_KEY"] == "already-set"
