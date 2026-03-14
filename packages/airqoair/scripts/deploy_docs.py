from __future__ import annotations

import argparse
import subprocess
import sys
import os
import tempfile
from pathlib import Path

import yaml


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
MKDOCS_CONFIG = PACKAGE_ROOT / "mkdocs.yml"


def run(command: list[str], cwd: Path) -> None:
    subprocess.run(command, cwd=str(cwd), check=True)


def git_output(command: list[str]) -> str:
    return subprocess.check_output(command, cwd=str(PACKAGE_ROOT), text=True).strip()


def current_branch() -> str:
    branch = git_output(["git", "branch", "--show-current"])
    return branch or "main"


def build_config(
    site_url: str | None,
    source_branch: str,
) -> tuple[Path, tempfile.TemporaryDirectory[str], Path]:
    loaded = yaml.safe_load(MKDOCS_CONFIG.read_text(encoding="utf-8"))
    if site_url:
        loaded["site_url"] = site_url.rstrip("/") + "/"

    loaded["edit_uri"] = f"edit/{source_branch}/packages/airqoair/docs/"
    temp_dir = tempfile.TemporaryDirectory()
    site_dir = Path(temp_dir.name) / "site"
    loaded["docs_dir"] = str((PACKAGE_ROOT / "docs").resolve())
    loaded["site_dir"] = str(site_dir)

    temp_fd, temp_name = tempfile.mkstemp(
        suffix=".mkdocs.yml",
        text=True,
    )
    os.close(temp_fd)
    temp_config = Path(temp_name)
    temp_config.write_text(yaml.safe_dump(loaded, sort_keys=False), encoding="utf-8")
    return temp_config, temp_dir, site_dir


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build or deploy the airqoair MkDocs site from the package root."
    )
    parser.add_argument(
        "--site-url",
        help="Override the site_url used for this build or deploy.",
    )
    parser.add_argument(
        "--remote-name",
        default="origin",
        help="Git remote to publish to when using gh-deploy.",
    )
    parser.add_argument(
        "--remote-branch",
        default="gh-pages",
        help="Git branch to publish to when using gh-deploy.",
    )
    parser.add_argument(
        "--build-only",
        action="store_true",
        help="Only build the site locally without publishing it.",
    )
    parser.add_argument(
        "--source-branch",
        help="Git branch name to use for edit links. Defaults to the current branch.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source_branch = args.source_branch or current_branch()
    config_path, temp_dir, _site_dir = build_config(args.site_url, source_branch)

    try:
        if args.build_only:
            run(
                [
                    sys.executable,
                    "-m",
                    "mkdocs",
                    "build",
                    "--strict",
                    "--config-file",
                    str(config_path),
                ],
                PACKAGE_ROOT,
            )
            return 0

        run(
            [
                sys.executable,
                "-m",
                "mkdocs",
                "gh-deploy",
                "--strict",
                "--clean",
                "--force",
                "--config-file",
                str(config_path),
                "--remote-name",
                args.remote_name,
                "--remote-branch",
                args.remote_branch,
            ],
            PACKAGE_ROOT,
        )
        return 0
    finally:
        temp_dir.cleanup()
        if config_path.exists():
            try:
                os.unlink(config_path)
            except PermissionError:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
