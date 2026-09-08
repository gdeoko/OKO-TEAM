#!/usr/bin/env python3
"""Static frontend follow-up for the existing Rocket r2 client installation.

No credentials, runtime data, PHP application code or nginx routes are changed.
Run --verify-source locally; server actions require an existing authorized shell.
"""
from pathlib import Path, PurePosixPath
import argparse
import fcntl
import hashlib
import http.client
import json
import os
import shutil
import ssl
import subprocess
import time
from urllib.parse import quote

SOURCE = Path(__file__).resolve().parent.parent
WEB = Path('/var/www')
BASE = WEB / 'rocket-releases/20260908-r2'
RELEASE = WEB / 'rocket-releases/20260908-r3'
STAGE = WEB / 'rocket-stage/20260908-r2'
SITES = ('rocketvpn', 'rocketcdn')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def records():
    rows = json.loads((SOURCE / 'deploy/followup-manifest.json').read_text())['files']
    seen = set()
    for row in rows:
        name = row['path']
        p = PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or len(p.parts) < 2 or p.parts[0] not in SITES:
            raise RuntimeError('Invalid frontend path')
        if p.suffix not in ('.html', '.css', '.js') or name in seen:
            raise RuntimeError('Unexpected or duplicate frontend file')
        seen.add(name)
    if not rows:
        raise RuntimeError('Empty frontend manifest')
    return rows


def verify(directory, field):
    for row in records():
        p = directory / row['path']
        if not p.is_file() or p.is_symlink() or digest(p) != row[field]:
            raise RuntimeError('File differs from manifest: ' + row['path'])


def active_at(target):
    for site in SITES:
        p = WEB / site
        if not p.is_symlink() or p.resolve() != target / site:
            raise RuntimeError('Unexpected active root: ' + site)


def run(*args):
    subprocess.run(args, check=True, capture_output=True, text=True, timeout=45)


def copy_frontends(target, isolated=False):
    for row in records():
        source, dest = SOURCE / row['path'], target / row['path']
        if isolated:
            text = source.read_text().replace('https://rocketcdn.ru/api.php',
                'https://rocketcdn.ru/_rocket-r2/cdn/api.php')
            dest.write_text(text)
        else:
            shutil.copy2(source, dest)
        dest.chmod(0o644)


def stage():
    verify(SOURCE, 'sha256')
    if not all((STAGE / site).is_dir() for site in SITES):
        raise RuntimeError('The isolated r2 stage must already exist')
    backup = Path('/var/backups/rocket') / ('stage-' + str(time.time_ns()))
    backup.mkdir(parents=True, mode=0o700)
    for row in records():
        dest = backup / row['path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(STAGE / row['path'], dest)
    copy_frontends(STAGE, isolated=True)
    run('systemctl', 'reload', 'php8.3-fpm')
    print(json.dumps({'stage_updated': True, 'backup': str(backup), 'production_changed': False}))


def prepare():
    verify(SOURCE, 'sha256')
    active_at(BASE)
    verify(BASE, 'base_sha256')
    if RELEASE.exists():
        raise RuntimeError('r3 directory already exists; inspect it before continuing')
    # Preserve ownership, modes and private runtime symlinks in the existing release.
    run('cp', '-a', str(BASE), str(RELEASE))
    copy_frontends(RELEASE)
    (RELEASE / 'deploy').mkdir(exist_ok=True)
    for name in ('followup.py', 'followup-manifest.json'):
        shutil.copy2(SOURCE / 'deploy' / name, RELEASE / 'deploy' / name)
    verify(RELEASE, 'sha256')
    print(json.dumps({'prepared': str(RELEASE), 'active_unchanged': True}))


def exchange(site, target):
    temp = WEB / (site + '.r3-' + str(os.getpid()))
    try:
        temp.symlink_to(target / site)
        os.replace(temp, WEB / site)
    finally:
        temp.unlink(missing_ok=True)


def request(host, path, body=None):
    # The TLS peer is this client's loopback, not an external credential recipient.
    conn = http.client.HTTPSConnection('127.0.0.1', timeout=12,
        context=ssl._create_unverified_context())
    try:
        conn.request('GET' if body is None else 'POST', path,
            body=json.dumps(body) if body is not None else None,
            headers={'Host': host, 'Content-Type': 'application/json'})
        response = conn.getresponse()
        return response.status, response.getheader('Content-Type', ''), response.read()
    finally:
        conn.close()


def health():
    active_at(RELEASE)
    verify(RELEASE, 'sha256')
    checks = 0
    for host in ('rocketvpn.top', 'rocketcdn.ru'):
        status, kind, _ = request(host, '/')
        if status != 200 or 'text/html' not in kind:
            raise RuntimeError('Main page health check failed: ' + host)
        for action, body, expected in [('content', {'site': 'vpn'}, True), ('operations', {}, False)]:
            status, kind, payload = request(host, '/api.php?action=' + action, body)
            if status != 200 or 'json' not in kind or json.loads(payload).get('ok') is not expected:
                raise RuntimeError('API health check failed: ' + host + '/' + action)
        checks += 3
    for row in records():
        site, path = row['path'].split('/', 1)
        if path == 'frame.html':
            continue  # Private PHP template; the public page is checked above.
        host = 'rocketvpn.top' if site == 'rocketvpn' else 'rocketcdn.ru'
        status, _, payload = request(host, '/' + quote(path))
        if status != 200 or hashlib.sha256(payload).hexdigest() != row['sha256']:
            raise RuntimeError('Published bytes differ: ' + row['path'])
        checks += 1
    run('systemctl', 'is-active', 'rocket-delivery.timer')
    print(json.dumps({'health_checks': checks + 1, 'ok': True}))


def activate():
    active_at(BASE)
    verify(BASE, 'base_sha256')
    verify(RELEASE, 'sha256')
    run('nginx', '-t')
    switched = []
    try:
        for site in SITES:
            exchange(site, RELEASE)
            switched.append(site)
        run('systemctl', 'reload', 'php8.3-fpm')
        health()
    except Exception:
        for site in reversed(switched):
            exchange(site, BASE)
        run('systemctl', 'reload', 'php8.3-fpm')
        raise
    print(json.dumps({'published': str(RELEASE), 'previous': str(BASE)}))


def rollback():
    active_at(RELEASE)
    verify(BASE, 'base_sha256')
    for site in reversed(SITES):
        exchange(site, BASE)
    run('systemctl', 'reload', 'php8.3-fpm')
    print(json.dumps({'rolled_back': True, 'runtime_records_unchanged': True}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('verify-source', 'stage', 'prepare', 'activate', 'health', 'rollback'))
    args = parser.parse_args()
    if args.action == 'verify-source':
        verify(SOURCE, 'sha256')
        print(json.dumps({'source_verified': len(records())}))
        return
    if os.geteuid() != 0:
        parser.error('Server operations require root on the existing client')
    os.umask(0o027)
    with open('/var/lock/rocket-frontends-r3.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        globals()[args.action]()


if __name__ == '__main__':
    main()
