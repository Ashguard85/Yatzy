#!/usr/bin/env python3
"""Unpack immutable Yatzy release ZIPs into versions/<version> and current/."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
UPLOADS = ROOT / "uploads"
VERSIONS = ROOT / "versions"
CURRENT = ROOT / "current"
LATEST_FILE = ROOT / "latest.json"
ARCHIVE_RE = re.compile(r"^yatzy-duell-(\d+)\.(\d+)\.(\d+)\.zip$")

REQUIRED = (
    "VERSION",
    "frontend/Dockerfile",
    "frontend/index.html",
    "frontend/nginx.conf",
    "frontend/service-worker.js",
    "backend/Dockerfile",
    "backend/server.js",
)


def fail(message: str) -> None:
    print(f"FEHLER: {message}", file=sys.stderr)
    raise SystemExit(1)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_member(name: str) -> None:
    normalized = name.replace("\\", "/")
    pure = PurePosixPath(normalized)
    if not normalized or normalized.startswith("/") or pure.is_absolute():
        fail(f"Unsicherer ZIP-Pfad: {name!r}")
    if any(part in ("", ".", "..") for part in pure.parts):
        fail(f"Unsicherer ZIP-Pfad: {name!r}")


def locate_payload(extract_root: Path) -> Path:
    if all((extract_root / rel).exists() for rel in REQUIRED):
        return extract_root

    children = [p for p in extract_root.iterdir() if p.name != "__MACOSX"]
    directories = [p for p in children if p.is_dir()]
    files = [p for p in children if p.is_file()]
    if not files and len(directories) == 1:
        candidate = directories[0]
        if all((candidate / rel).exists() for rel in REQUIRED):
            return candidate

    missing = [rel for rel in REQUIRED if not (extract_root / rel).exists()]
    fail("Ungültige Release-Struktur. Fehlend: " + ", ".join(missing))
    raise AssertionError("unreachable")


def extract_archive(archive: Path, version: str, destination: Path) -> str:
    archive_hash = sha256(archive)

    if destination.exists():
        marker = destination / ".release-sha256"
        previous_hash = marker.read_text(encoding="utf-8").strip() if marker.exists() else ""
        if previous_hash == archive_hash:
            print(f"Version {version} ist bereits unverändert entpackt.")
            return archive_hash
        fail(
            f"Version {version} existiert bereits mit anderem Inhalt. "
            "Veröffentlichte Versionen werden nicht überschrieben; verwende eine neue Versionsnummer."
        )

    with tempfile.TemporaryDirectory(prefix="yatzy-release-") as temp_name:
        temp_root = Path(temp_name)
        with zipfile.ZipFile(archive) as package:
            infos = package.infolist()
            if not infos:
                fail(f"Leeres ZIP: {archive.name}")
            for info in infos:
                validate_member(info.filename)
                # Refuse Unix symlinks stored in ZIP archives.
                mode = (info.external_attr >> 16) & 0o170000
                if mode == 0o120000:
                    fail(f"Symbolische Links sind im Release nicht erlaubt: {info.filename}")
            package.extractall(temp_root)

        payload = locate_payload(temp_root)
        embedded_version = (payload / "VERSION").read_text(encoding="utf-8").strip()
        if embedded_version != version:
            fail(
                f"Versionsfehler in {archive.name}: Dateiname={version}, "
                f"VERSION-Datei={embedded_version!r}"
            )

        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(payload, destination)
        (destination / ".release-sha256").write_text(archive_hash + "\n", encoding="utf-8")
        (destination / ".release-source").write_text(
            archive.relative_to(ROOT).as_posix() + "\n", encoding="utf-8"
        )
        print(f"Version {version} nach {destination.relative_to(ROOT)} entpackt.")

    return archive_hash


def version_key(name: str) -> tuple[int, int, int]:
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", name)
    if not match:
        return (-1, -1, -1)
    return tuple(int(part) for part in match.groups())


def main() -> None:
    archives: list[tuple[tuple[int, int, int], str, Path]] = []
    for archive in sorted(UPLOADS.glob("yatzy-duell-*.zip")):
        match = ARCHIVE_RE.fullmatch(archive.name)
        if not match:
            fail(
                f"Ungültiger Dateiname {archive.name!r}. Erwartet: "
                "yatzy-duell-X.Y.Z.zip"
            )
        key = tuple(int(part) for part in match.groups())
        version = ".".join(match.groups())
        archives.append((key, version, archive))

    if not archives:
        fail("Keine Release-ZIPs unter uploads/ gefunden.")

    VERSIONS.mkdir(parents=True, exist_ok=True)
    archive_hashes: dict[str, str] = {}
    for _, version, archive in archives:
        archive_hashes[version] = extract_archive(archive, version, VERSIONS / version)

    available_versions = [p for p in VERSIONS.iterdir() if p.is_dir() and version_key(p.name) >= (0, 0, 0)]
    if not available_versions:
        fail("Keine gültige entpackte Version vorhanden.")

    latest_dir = max(available_versions, key=lambda p: version_key(p.name))
    latest_version = latest_dir.name

    if CURRENT.exists():
        shutil.rmtree(CURRENT)
    shutil.copytree(latest_dir, CURRENT)

    source_marker = (latest_dir / ".release-source").read_text(encoding="utf-8").strip()
    hash_marker = (latest_dir / ".release-sha256").read_text(encoding="utf-8").strip()
    latest_data = {
        "version": latest_version,
        "source": source_marker,
        "sha256": hash_marker,
        "frontend_context": "current/frontend",
        "backend_context": "current/backend",
    }
    LATEST_FILE.write_text(
        json.dumps(latest_data, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"current/ zeigt jetzt auf den Inhalt von Version {latest_version}.")


if __name__ == "__main__":
    main()
