#!/usr/bin/env python3
from __future__ import annotations
import argparse
import base64
import hashlib
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
VERSION_PATTERN = re.compile(
    r"^.+_v(?P<version>\d+\.\d+\.\d+-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)"
    r"\.(?P<extension>mcpack|brproject)$",
    re.IGNORECASE,
)
SUPPORTED_EXTENSIONS = {
    ".mcpack",
    ".brproject",
}
def calculate_sha512(path: Path) -> str:
    hasher = hashlib.sha512()
    with path.open("rb") as file:
        while True:
            chunk = file.read(1024 * 1024)
            if not chunk:
                break
            hasher.update(chunk)
    return base64.b64encode(
        hasher.digest()
    ).decode("ascii")
def get_file_size(path: Path) -> int:
    return path.stat().st_size
def get_release_date() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime(
        "%Y-%m-%dT%H:%M:%S.000Z"
    )
def parse_release_filename(path: Path):
    match = VERSION_PATTERN.match(path.name)
    if not match:
        return None
    return {
        "version": match.group("version"),
        "extension": match.group("extension").lower(),
    }
def find_release_files(release_directory: Path):
    files = []
    for path in release_directory.iterdir():
        if not path.is_file():
            continue
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        parsed = parse_release_filename(path)
        if parsed is None:
            raise ValueError(
                f"Invalid release filename: {path.name}\n"
                "Expected format:\n"
                "PackName_vx.x.x-versionstatus.x.mcpack"
            )
        files.append(
            {
                "path": path,
                "version": parsed["version"],
                "extension": parsed["extension"],
            }
        )
    return files
def validate_versions(files):
    versions = {
        file["version"]
        for file in files
    }
    if len(versions) > 1:
        formatted = "\n".join(
            f"  {file['path'].name}: "
            f"{file['version']}"
            for file in files
        )
        raise ValueError(
            "Release files contain different versions:\n"
            f"{formatted}"
        )
def yaml_string(value: str) -> str:
    escaped = value.replace("\\", "\\\\")
    escaped = escaped.replace("'", "''")
    return f"'{escaped}'"
def generate_latest_yml(
    files,
    output_path: Path,
):
    mcpack = next(
        (
            file
            for file in files
            if file["extension"] == "mcpack"
        ),
        None,
    )
    if mcpack is None:
        raise ValueError(
            "No .mcpack file was found."
        )
    version = files[0]["version"]
    release_date = get_release_date()
    output = []
    output.append(
        f"version: {version}"
    )
    output.append("files:")
    for file in files:
        path = file["path"]
        sha512 = calculate_sha512(path)
        size = get_file_size(path)
        output.append(
            f"  - url: {path.name}"
        )
        output.append(
            f"    sha512: {sha512}"
        )
        output.append(
            f"    size: {size}"
        )
    mcpack_path = mcpack["path"]
    mcpack_hash = calculate_sha512(
        mcpack_path
    )
    output.append(
        f"path: {mcpack_path.name}"
    )
    output.append(
        f"sha512: {mcpack_hash}"
    )
    output.append(
        f"releaseDate: {yaml_string(release_date)}"
    )
    output_path.write_text(
        "\n".join(output) + "\n",
        encoding="utf-8",
    )
    return version, release_date
def main():
    parser = argparse.ArgumentParser(
        description=(
            "Generate latest.yml for a Vantage release."
        )
    )
    parser.add_argument(
        "--directory",
        "-d",
        type=Path,
        default=Path("builds/releases"),
        help=(
            "Directory containing release files "
            "(default: builds/releases)"
        ),
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=None,
        help=(
            "Output path for latest.yml "
            "(default: <directory>/latest.yml)"
        ),
    )
    args = parser.parse_args()
    release_directory = (
        args.directory.expanduser().resolve()
    )
    if not release_directory.exists():
        print(
            f"ERROR: Release directory does not exist:\n"
            f"  {release_directory}",
            file=sys.stderr,
        )
        return 1
    if not release_directory.is_dir():
        print(
            f"ERROR: Not a directory:\n"
            f"  {release_directory}",
            file=sys.stderr,
        )
        return 1
    output_path = (
        args.output.expanduser().resolve()
        if args.output
        else release_directory / "latest.yml"
    )
    try:
        files = find_release_files(
            release_directory
        )
        if not files:
            raise ValueError(
                "No .mcpack or .brproject files were found."
            )
        validate_versions(files)
        version, release_date = (
            generate_latest_yml(
                files,
                output_path,
            )
        )
    except (OSError, ValueError) as error:
        print(
            f"ERROR: {error}",
            file=sys.stderr,
        )
        return 1
    print()
    print("✓ Release detected")
    print(f"  Version:     {version}")
    print(f"  Release date: {release_date}")
    print()
    for file in files:
        path = file["path"]
        sha512 = calculate_sha512(path)
        size = get_file_size(path)
        print(
            f"✓ {path.name}"
        )
        print(
            f"  Size:   {size:,} bytes"
        )
        print(
            f"  SHA512: {sha512}"
        )
        print()
    print(
        f"✓ Generated:"
    )
    print(
        f"  {output_path}"
    )
    return 0
if __name__ == "__main__":
    raise SystemExit(
        main()
    )