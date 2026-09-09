#!/usr/bin/env python3
"""Read-only checks of the deployed Rocket bytes, public pages, APIs and audio ranges.

This does not execute browser JavaScript or measure device performance.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import sys
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / 'deploy/followup-manifest.json').read_text())
HOSTS = {'rocketcdn': 'https://rocketcdn.ru', 'rocketvpn': 'https://rocketvpn.top'}


def request(url, body=None, headers=None, limit=None):
    headers = {'Cache-Control': 'no-cache', **(headers or {})}
    if body is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(body).encode()
    with urlopen(Request(url, data=body, headers=headers), timeout=18) as response:
        return response.status, response.headers, response.read(limit)


def check_file(row):
    site, path = row['path'].split('/', 1)
    url = HOSTS[site] + '/' + quote(path)
    try:
        status, _, data = request(url)
        matches = hashlib.sha256(data).hexdigest() == row['sha256']
        return {'kind': 'file', 'url': url, 'path': row['path'], 'status': status,
                'sha256_matches_release': matches, 'ok': status == 200 and matches}
    except Exception as error:
        return {'kind': 'file', 'url': url, 'ok': False, 'error': str(error)}


def main():
    rows = [r for r in MANIFEST['files'] if r['path'] != 'rocketvpn/frame.html']
    checks = list(ThreadPoolExecutor(4).map(check_file, rows))
    for url in ['https://rocketvpn.top/', 'https://rocketcdn.ru/',
                'https://rocketcdn.ru/?flight=1', 'https://rocketcdn.ru/admin.html']:
        try:
            status, headers, _ = request(url)
            checks.append({'kind': 'page', 'url': url, 'status': status,
                           'ok': status == 200 and 'text/html' in headers.get('Content-Type', '')})
        except Exception as error:
            checks.append({'kind': 'page', 'url': url, 'ok': False, 'error': str(error)})
    for host in HOSTS.values():
        for action, body, expected in [('content', {'site': 'vpn'}, True), ('operations', {}, False)]:
            url = host + '/api.php?action=' + action
            try:
                status, _, data = request(url, body=body)
                checks.append({'kind': 'api', 'url': url, 'status': status,
                               'ok': status == 200 and json.loads(data).get('ok') is expected})
            except Exception as error:
                checks.append({'kind': 'api', 'url': url, 'ok': False, 'error': str(error)})
    for site, path in [('rocketcdn', 'assets/audio/theme.webm'),
                       ('rocketcdn', 'assets/audio/theme.m4a'), ('rocketvpn', 'assets/snd/fon.m4a')]:
        url = HOSTS[site] + '/' + path
        try:
            status, headers, data = request(url, headers={'Range': 'bytes=0-1023'}, limit=1024)
            valid_range = status == 206 and headers.get('Content-Range', '').startswith('bytes 0-1023/')
            checks.append({'kind': 'audio_range', 'url': url, 'status': status,
                           'ok': valid_range and len(data) == 1024})
        except Exception as error:
            checks.append({'kind': 'audio_range', 'url': url, 'ok': False, 'error': str(error)})
    report = {'release': MANIFEST['release'], 'checked_at_utc': datetime.now(timezone.utc).isoformat(),
              'scope': 'External HTTPS with certificate validation; no browser execution or device FPS',
              'checks': checks, 'passed': sum(c['ok'] for c in checks), 'total': len(checks)}
    output = ROOT / 'review' / (MANIFEST['release'].split('-')[-1] + '-public-verification.json')
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'passed': report['passed'], 'total': report['total'], 'report': str(output),
                      'failures': [c for c in checks if not c['ok']]}))
    return 0 if report['passed'] == report['total'] else 1


if __name__ == '__main__':
    sys.exit(main())
