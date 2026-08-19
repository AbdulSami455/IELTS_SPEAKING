"""Seed a published question set for local development."""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from sqlalchemy import select

from ielts_config.config import EnvironmentConfig
from ielts_db.database import DatabaseConfig, get_database_url
from ielts_db.models import Base, Question, QuestionSet
from ielts_db.storage import ObjectStore


ROOT = Path(__file__).resolve().parents[1]


def _load_env() -> None:
    env_path = ROOT / ".env"
    example = ROOT / ".env.example"
    if env_path.exists():
        source = env_path
    elif example.exists():
        source = example
    else:
        return
    for line in source.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


async def main() -> None:
    _load_env()
    os.environ.setdefault("DATABASE_URL", "postgresql://ielts:ielts@localhost:5432/ielts")
    db = DatabaseConfig(get_database_url())
    async with db.engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    payload_files = sorted((ROOT / "config" / "question-banks").glob("*.json"))
    if not payload_files:
        raise SystemExit("No files in config/question-banks")
    async with db.session_factory() as session:
        for path in payload_files:
            payload = json.loads(path.read_text())
            existing = await session.execute(
                select(QuestionSet).where(QuestionSet.slug == payload["slug"], QuestionSet.version == payload["version"])
            )
            if existing.scalar_one_or_none() is not None:
                print(f"Question set already present: {payload['slug']}")
                continue
            question_set = QuestionSet(
                slug=payload["slug"],
                version=payload["version"],
                language=payload.get("language", "en"),
                is_published=True,
            )
            session.add(question_set)
            await session.flush()
            for item in payload["questions"]:
                session.add(
                    Question(
                        question_set_id=question_set.id,
                        part=item["part"],
                        sort_order=item["sort_order"],
                        prompt_text=item["prompt_text"],
                        cue_card=item.get("cue_card"),
                        follow_ups=item.get("follow_ups"),
                        timing_seconds=item.get("timing_seconds"),
                        examiner_asset_version="v1",
                    )
                )
            print(f"Seeded question set {payload['slug']}")
        await session.commit()
    try:
        store = ObjectStore(EnvironmentConfig.from_env())
        store.ensure_buckets()
        print("MinIO buckets ready; examiner TTS is generated on first playback")
    except Exception as exc:
        print(f"MinIO seed skipped: {exc}")
    await db.dispose()


if __name__ == "__main__":
    asyncio.run(main())
