#!/usr/bin/env python3
"""Reversible Rocket release switch. Runs on the client as root.

No credentials or business records are printed. Runtime configuration and data
stay on the client. --rollback restores code/config while retaining new records.
"""
from pathlib import Path
import ctypes, hashlib, json, os, re, shutil, signal, subprocess, sys, tarfile, time

VERSION = '20260908-r2'
RELEASE = Path('/var/www/rocket-releases') / VERSION
PREVIOUS = Path('/var/www/rocket-releases') / ('pre-' + VERSION)
BACKUP = Path('/var/backups/rocket') / VERSION
FLAG = Path('/var/www/rocket-maintenance.flag')
SITES = ['rocketcdn', 'rocketvpn']

def run(*args, timeout=90):
    r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if r.returncode: raise RuntimeError('Command failed: ' + ' '.join(args[:3]))
    return r.stdout

def report(stage, **values):
    print(json.dumps({'stage': stage, **values}), flush=True)

def exchange(a, b):
    libc = ctypes.CDLL(None, use_errno=True)
    result = libc.renameat2(-100, os.fsencode(a), -100, os.fsencode(b), 2)
    if result: raise OSError(ctypes.get_errno(), 'Atomic root exchange failed')

def nginx_conf(site):
    return Path('/etc/nginx/sites-available') / site

def stop_writers():
    run('systemctl', 'stop', 'cron')
    run('systemctl', 'stop', 'php8.3-fpm')
    # Cron no longer launches new jobs. Let existing Rocket jobs finish naturally.
    deadline = time.monotonic() + 150
    while True:
        active = []
        for p in Path('/proc').iterdir():
            if not p.name.isdigit(): continue
            try: cmd = (p / 'cmdline').read_bytes().replace(b'\0', b' ').decode(errors='replace')
            except (OSError, ProcessLookupError): continue
            if re.search(r'(?:^|/)php(?:\d+(?:\.\d+)?)?\s+/var/www/rocketcdn/(bot|cron|delivery-worker)\.php(?:\s|$)', cmd):
                active.append(p.name)
        if not active: return
        if time.monotonic() >= deadline: raise RuntimeError('Rocket writers did not drain; release cancelled')
        time.sleep(.5)

def start_writers():
    run('systemctl', 'start', 'php8.3-fpm')
    run('systemctl', 'start', 'cron')

def preflight():
    manifest = json.loads((RELEASE / 'release-manifest.json').read_text())
    mismatch = [name for name, digest in manifest.items()
                if not (RELEASE / name).is_file() or hashlib.sha256((RELEASE / name).read_bytes()).hexdigest() != digest]
    if mismatch: raise RuntimeError('Release source mismatch: ' + ', '.join(mismatch[:15]))
    for site in SITES:
        assert not (Path('/var/www') / site).is_symlink(), 'Already switched or unexpected root'
        for p in (RELEASE / site).rglob('*.php'):
            if p.name != 'config.local.php': run('php', '-l', str(p))
    check = run('runuser', '-u', 'www-data', '--', 'php', '-r', "require '/var/www/rocketcdn/config.php'; echo json_encode(['external'=>RC_DATA==='/var/www/rocketcdn-data','admin'=>strlen((string)rc_cfg('admin_key'))>12,'writable'=>is_writable(RC_DATA)]);")
    assert all(json.loads(check).values()), 'Unexpected data directory or missing admin configuration'
    assert shutil.disk_usage('/var/www').free > 1024 ** 3, 'Insufficient rollback space'
    report('preflight_passed', verified_files=len(manifest))

def configure():
    for site in SITES:
        original = nginx_conf(site).read_text()
        shutil.copy2(nginx_conf(site), BACKUP / (site + '.nginx'))
        blocks = ['if (-f /var/www/rocket-maintenance.flag) { return 503; }',
                  'location ^~ /tests/ { return 404; }']
        private = ['content.php'] if site == 'rocketvpn' else [
            'storage.php', 'delivery.php', 'delivery-worker.php', 'admin-operations.php', 'backup.php']
        blocks.extend('location = /' + name + ' { return 404; }' for name in private)
        if site == 'rocketvpn':
            blocks.append('location = /api.php { include fastcgi_params; fastcgi_param SCRIPT_FILENAME /var/www/rocketcdn/api.php; fastcgi_pass unix:/run/php/php8.3-fpm.sock; }')
        changed, count = re.subn(r'(root\s+/var/www/' + site + r';)', lambda m: m[0] + '\n    ' + '\n    '.join(blocks), original, count=1)
        assert count == 1, 'Unexpected nginx root'
        nginx_conf(site).write_text(changed)
    run('nginx', '-t')
    run('systemctl', 'reload', 'nginx')

def install_worker():
    Path('/etc/systemd/system/rocket-delivery.service').write_text('''[Unit]
Description=Rocket durable notification delivery
After=network-online.target

[Service]
Type=oneshot
User=www-data
Group=www-data
ExecStart=/usr/bin/php /var/www/rocketcdn/delivery-worker.php
TimeoutStartSec=180
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/rocketcdn-data
''')
    Path('/etc/systemd/system/rocket-delivery.timer').write_text('''[Unit]
Description=Process saved Rocket notifications

[Timer]
OnActiveSec=5
OnUnitInactiveSec=30
AccuracySec=5
Unit=rocket-delivery.service

[Install]
WantedBy=timers.target
''')
    run('systemctl', 'daemon-reload')
    run('systemctl', 'enable', '--now', 'rocket-delivery.timer')

def activate():
    preflight()
    assert not PREVIOUS.exists() and not (BACKUP / 'activated.json').exists(), 'Release was already attempted'
    BACKUP.mkdir(parents=True, mode=0o700, exist_ok=True)
    BACKUP.chmod(0o700)
    PREVIOUS.mkdir(parents=True)
    switched = []
    try:
        configure()
        FLAG.touch()
        stop_writers()
        report('writers_drained')
        with tarfile.open(BACKUP / 'runtime.tar.gz', 'w:gz') as t:
            t.add('/var/www/rocketcdn-data', arcname='rocketcdn-data')
            for site in SITES:
                p = Path('/var/www') / site / 'config.local.php'
                if p.exists():
                    t.add(p, arcname=site + '/config.local.php')
                    shutil.copy2(p, RELEASE / site / 'config.local.php')
        (BACKUP / 'runtime.tar.gz').chmod(0o600)
        report('runtime_backup_saved')
        for site in SITES:
            run('chown', '-R', 'www-data:www-data', str(RELEASE / site))
            private = RELEASE / site / 'config.local.php'
            if private.exists(): private.chmod(0o640)
            (PREVIOUS / site).symlink_to(RELEASE / site, target_is_directory=True)
            exchange(PREVIOUS / site, Path('/var/www') / site)
            switched.append(site)
        start_writers()  # also resets PHP's realpath/opcode cache
        FLAG.unlink(missing_ok=True)
        run('nginx', '-t')
        install_worker()
        (BACKUP / 'activated.json').write_text(json.dumps({'release': VERSION, 'at': time.time(), 'sites': SITES}))
        report('activated', release=VERSION, sites=SITES, rollback_available=True)
    except Exception:
        FLAG.touch()
        subprocess.run(['systemctl', 'disable', '--now', 'rocket-delivery.timer'], capture_output=True)
        subprocess.run(['systemctl', 'stop', 'rocket-delivery.service'], capture_output=True)
        if switched:
            stop_writers()
            for site in reversed(switched): exchange(PREVIOUS / site, Path('/var/www') / site)
        for site in SITES:
            old = BACKUP / (site + '.nginx')
            if old.exists(): shutil.copy2(old, nginx_conf(site))
        run('nginx', '-t'); run('systemctl', 'reload', 'nginx')
        raise
    finally:
        start_writers()
        FLAG.unlink(missing_ok=True)

def rollback():
    assert (BACKUP / 'activated.json').exists(), 'No completed release to roll back'
    for site in SITES:
        assert (Path('/var/www') / site).resolve() == RELEASE / site, 'Unexpected active release'
    FLAG.touch()
    try:
        run('systemctl', 'disable', '--now', 'rocket-delivery.timer')
        run('systemctl', 'stop', 'rocket-delivery.service')
        stop_writers()
        for site in reversed(SITES): exchange(PREVIOUS / site, Path('/var/www') / site)
        for site in SITES: shutil.copy2(BACKUP / (site + '.nginx'), nginx_conf(site))
        run('nginx', '-t'); run('systemctl', 'reload', 'nginx')
        report('rolled_back', live_records_preserved=True)
    finally:
        start_writers(); FLAG.unlink(missing_ok=True)

if __name__ == '__main__':
    try:
        if '--rollback' in sys.argv: rollback()
        elif '--check' in sys.argv: preflight()
        else: activate()
    except Exception as e:
        report('failed', error=str(e)); sys.exit(1)
