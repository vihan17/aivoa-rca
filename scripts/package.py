"""Build a clean submission zip without secrets, dependencies or screenshots."""
from __future__ import annotations

import shutil
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / "release"
ARCHIVE = RELEASE / "aivoa-rca-submission.zip"
STAGE = Path(tempfile.gettempdir()) / "aivoa-rca-submission"
PACKAGE_ROOT = "aivoa-rca"

IGNORE = shutil.ignore_patterns(
    ".venv",
    "node_modules",
    "__pycache__",
    "*.pyc",
    ".env",
    "artifacts",
    ".pytest_cache",
    ".mypy_cache",
)

ROOT_FILES = [
    "README.md",
    ".gitignore",
    "run.ps1",
    "reset-demo.ps1",
    "package-submission.ps1",
]
ROOT_DIRS = ["backend", "frontend", "samples", "scripts", "docs"]


def copy_item(source: Path, target: Path) -> None:
    if source.is_dir():
        shutil.copytree(source, target, ignore=IGNORE)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)


def main() -> None:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)

    for name in ROOT_FILES:
        source = ROOT / name
        if source.exists():
            copy_item(source, STAGE / PACKAGE_ROOT / name)

    for name in ROOT_DIRS:
        source = ROOT / name
        if source.exists():
            copy_item(source, STAGE / PACKAGE_ROOT / name)

    RELEASE.mkdir(exist_ok=True)
    if ARCHIVE.exists():
        ARCHIVE.unlink()

    files = 0
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(STAGE.rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(STAGE))
                files += 1

    size_mb = ARCHIVE.stat().st_size / (1024 * 1024)
    print(f"Created {ARCHIVE} ({size_mb:.2f} MB, {files} files)")
    print("Excluded: backend/.env, .venv, node_modules, __pycache__, artifacts")


if __name__ == "__main__":
    main()
