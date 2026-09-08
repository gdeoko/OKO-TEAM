#!/usr/bin/env python3
"""Apply only the listed Rocket changes to an existing development checkout.

Default: inspect without writing. No merge, reset, deletion, commit or push.
The independent release branch must never replace a monorepo tree.
"""
from pathlib import Path, PurePosixPath
import argparse
import fcntl
import hashlib
import json
import os
import subprocess
import tempfile

SOURCE = Path(__file__).resolve().parent.parent


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def safe(root, name):
    p = PurePosixPath(name)
    if p.is_absolute() or '..' in p.parts or len(p.parts) < 2 or p.parts[0] not in ('rocketvpn', 'rocketcdn'):
        raise ValueError('Outside Rocket: ' + name)
    dest = root.joinpath(*p.parts)
    for part in [dest, *dest.parents]:
        if part == root:
            break
        if part.is_symlink():
            raise ValueError('Symlink in destination: ' + name)
    if dest.exists() and not dest.is_file():
        raise ValueError('Not a regular file: ' + name)
    return dest


def inspect(source, target, manifest):
    plan, conflicts, seen = [], [], set()
    rows = manifest['files']
    for row in rows:
        name = row['path']
        if name in seen:
            raise ValueError('Duplicate path: ' + name)
        seen.add(name)
        src, dest = safe(source, name), safe(target, name)
        data = src.read_bytes()
        if blob(data) != row['sha']:
            raise ValueError('Source changed: ' + name)
        before = dest.read_bytes() if dest.exists() else None
        current = blob(before) if before is not None else None
        if current == row['sha']:
            continue
        if current != row['base_sha']:
            conflicts.append(name)
        else:
            plan.append((dest, before, data, int(row['mode'], 8) & 0o777))
    # This is an overlay, not a partial installation into an unrelated main.
    missing = [name for name in manifest['required'] if name not in seen and not safe(target, name).is_file()]
    if conflicts or missing:
        raise ValueError(json.dumps({'conflicts': conflicts, 'missing_prerequisites': missing}, ensure_ascii=False))
    return plan


def write_atomic(dest, data, mode):
    dest.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.rocket-integrate-', dir=dest.parent)
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
            os.fchmod(handle.fileno(), mode)
        os.replace(name, dest)
    finally:
        Path(name).unlink(missing_ok=True)


def apply(plan):
    written = []
    try:
        for dest, before, data, mode in plan:
            current = dest.read_bytes() if dest.exists() else None
            if current != before:
                raise ValueError('Concurrent edit: ' + str(dest))
            old_mode = dest.stat().st_mode & 0o777 if before is not None else None
            write_atomic(dest, data, mode)
            written.append((dest, before, data, old_mode))
    except Exception:
        for dest, before, data, mode in reversed(written):
            if dest.read_bytes() != data:
                continue  # Preserve a newer concurrent change.
            if before is None:
                dest.unlink()  # Undo only a file created by this failed attempt.
            else:
                write_atomic(dest, before, mode)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    target = args.target.resolve()
    top = subprocess.check_output(['git', '-C', str(target), 'rev-parse', '--show-toplevel'], text=True).strip()
    if Path(top).resolve() != target or target == SOURCE:
        parser.error('Target must be another repository root')
    if subprocess.check_output(['git', '-C', str(target), 'status', '--porcelain', '--untracked-files=normal']):
        parser.error('Target has pending changes; preserve them before integration')
    gitdir = Path(subprocess.check_output(['git', '-C', str(target), 'rev-parse', '--absolute-git-dir'], text=True).strip())
    manifest = json.loads((SOURCE / 'deploy/rocket-overlay.json').read_text())
    with (gitdir / 'rocket-integrate.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        plan = inspect(SOURCE, target, manifest)
        if args.apply:
            apply(plan)
        print(json.dumps({'applied': args.apply, 'files': len(plan), 'deletions': 0,
            'paths': [str(x[0].relative_to(target)) for x in plan]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
