#!/usr/bin/env python3
"""Read-only acceptance checks; keep runtime credentials and records on the server."""
from pathlib import Path
import http.client,json,ssl,subprocess

def request(host,path,body=None):
    c=http.client.HTTPSConnection('127.0.0.1',timeout=12,context=ssl._create_unverified_context())
    c.request('POST' if body is not None else 'GET',path,body=json.dumps(body) if body is not None else None,
              headers={'Host':host,'Content-Type':'application/json','Connection':'close'})
    r=c.getresponse();data=r.read();result=(r.status,r.getheader('Content-Type',''),data);c.close();return result

results=[]
for host,path,expected,kind in [
 ('rocketcdn.ru','/',200,'text/html'),('rocketvpn.top','/',200,'text/html'),
 ('rocketcdn.ru','/admin.html',200,'text/html'),
 ('rocketcdn.ru','/assets/rc-cabin.js?v=20260908r2',200,'javascript'),
 ('rocketcdn.ru','/assets/rc-flight.js?v=20260908r2',200,'javascript'),
 ('rocketvpn.top','/assets/rv-assembly.js',200,'javascript'),
 ('rocketcdn.ru','/delivery-worker.php',404,''),('rocketcdn.ru','/tests/backup.php',404,''),
 ('rocketvpn.top','/content.php',404,''),('rocketcdn.ru','/data/leads.json',403,'')]:
    status,ctype,_=request(host,path)
    passed=status==expected and kind in ctype
    # Existing data guard may deliberately use 404 to conceal the resource.
    if path=='/data/leads.json':passed=status in [403,404]
    results.append({'host':host,'path':path,'status':status,'ok':passed})
for host in ['rocketcdn.ru','rocketvpn.top']:
    status,ctype,data=request(host,'/api.php?action=content',{'site':'vpn'})
    content=json.loads(data)
    results.append({'host':host,'check':'VPN content API','ok':status==200 and 'json' in ctype and content.get('ok') and isinstance(content.get('content'),dict) and bool(content['content'])})
    _,_,data=request(host,'/api.php?action=operations',{})
    results.append({'host':host,'check':'admin rejects unauthenticated access','ok':json.loads(data).get('ok') is False})
# The administrative key stays inside the client process and HTTPS loopback.
key=subprocess.run(['php','-r',"$c=include '/var/www/rocketcdn/config.local.php'; echo json_encode($c['admin_key']);"],capture_output=True,text=True,check=True)
_,_,body=request('rocketvpn.top','/api.php?action=operations',{'key':json.loads(key.stdout)})
op=json.loads(body);release=op.get('release',{})
results.append({'host':'rocketvpn.top','check':'authenticated shared admin','ok':op.get('ok') is True and release.get('version')=='2026.09.08-r2' and release.get('storage') is True})
worker=subprocess.run(['systemctl','is-active','rocket-delivery.timer'],capture_output=True,text=True)
results.append({'check':'delivery timer active','ok':worker.returncode==0})
import time
results.append({'check':'delivery worker heartbeat recent','ok':isinstance(release.get('queue_worker_at'),int) and time.time()-release['queue_worker_at']<180})
for site in ['rocketcdn','rocketvpn']:
 results.append({'check':site+' active root','ok':(Path('/var/www')/site).resolve()==Path('/var/www/rocket-releases/20260908-r2')/site})
for row in results:print(json.dumps(row,ensure_ascii=False))
print(json.dumps({'passed':sum(bool(r['ok']) for r in results),'checks':len(results)}))
raise SystemExit(0 if all(r['ok'] for r in results) else 1)
