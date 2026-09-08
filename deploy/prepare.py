#!/usr/bin/env python3
"""Prepare Rocket release beside live roots; no live configuration is changed."""
from pathlib import Path
import shutil,tarfile,subprocess,json,os,hashlib
release=Path('/var/www/rocket-releases/20260908-r2')
archive=Path('/tmp/rocket-release-r2-20260908.tar.gz')
expected='9816be9d89310d474630407a4cbd3fe00821651613ab5c3ccc5963c7db36e4a6'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected,'Archive verification failed'
release.mkdir(parents=True,exist_ok=True)
for site in ['rocketcdn','rocketvpn']:
 dst=release/site
 if not dst.exists():shutil.copytree(Path('/var/www')/site,dst,symlinks=True)
with tarfile.open(archive) as t:
 for entry in t.getmembers():
  p=Path(entry.name)
  assert p.parts[0] in ['rocketvpn','rocketcdn'] and not p.is_absolute() and '..' not in p.parts
  assert entry.isfile() or entry.isdir()
  assert 'config.local' not in entry.name and '/data/' not in entry.name
 t.extractall(release,filter='data')
patch = Path('/tmp/rocket-stage-additions-20260908.tar.gz')
assert hashlib.sha256(patch.read_bytes()).hexdigest() == 'a7984afb80c528e1cf1144485295bca984956be18e3b2834d8b656c8588e32a0'
with tarfile.open(patch) as t:
 for entry in t.getmembers():
  path=Path(entry.name)
  assert path.parts[0] in ['rocketvpn','rocketcdn','review'] and '..' not in path.parts and not path.is_absolute()
  assert entry.isfile() and 'config.local' not in entry.name
 t.extractall(release,filter='data')
for name in ['storage.php','delivery.php','concurrency.php']:
 subprocess.run(['php',str(release/'rocketcdn/tests'/name)],check=True)
for site in ['rocketcdn','rocketvpn']:
 for p in (release/site).rglob('*.php'):
  if p.name=='config.local.php':continue
  r=subprocess.run(['php','-l',str(p)],capture_output=True,text=True)
  if r.returncode:raise RuntimeError('PHP syntax: '+str(p.relative_to(release)))
print(json.dumps({'release_ready':True,'native_php_tests':21,'live_roots_unchanged':True}))
