import {PHP} from '@php-wasm/universal';
import {loadNodeRuntime} from '@php-wasm/node';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url));
import assert from 'node:assert/strict';
const php=new PHP(await loadNodeRuntime('8.3',{emscriptenOptions:{processId:process.pid}}));
php.mkdir('/app');php.mkdir('/data');
for(const f of ['config.php','storage.php','api.php'])php.writeFile('/app/'+f,fs.readFileSync(source+f));
php.writeFile('/app/config.local.php',`<?php return ['data_dir'=>'/data','admin_key'=>'offline-test-only-key','tg_admins'=>[]];`);
async function call(action,body){const r=await php.run({scriptPath:'/app/api.php',relativeUri:'/?action='+action,method:'POST',headers:{'Content-Type':'application/json'},body:new TextEncoder().encode(JSON.stringify(body))});assert.equal(r.exitCode,0,r.errors);return {status:r.httpStatusCode,data:JSON.parse(r.text)};}
const e={id:'test:1',t:'длинноесобытиетеста',l:'юникод'};
assert.equal((await call('track',{sid:'session',site:'vpn',events:[e,{id:'test:2',t:'view'}]})).data.ok,true);
assert.equal((await call('track',{sid:'session',site:'vpn',events:[e,{id:'test:2',t:'view'}]})).data.ok,true);
const files=php.listFiles('/data/stats/vpn');const file='/data/stats/vpn/'+files.find(x=>x.endsWith('.json'));
const d=JSON.parse(php.readFileAsText(file));assert.equal(d.views,1);assert.equal(d.events[e.t],1);console.log('PASS: real API deduplicates retry, preserves Cyrillic event type');
await call('track',{sid:'session2',site:'vpn',events:[{id:'test:3',t:'view'},{id:'test:4',t:'view'}]});
const d2=JSON.parse(php.readFileAsText(file));assert.equal(d2.views,3);assert.equal(Object.values(d2.devices).reduce((a,b)=>a+b,0),2);console.log('PASS: device counted once per visitor in batched views');
php.writeFile('/data/leads.json','{"items":');
const failed=await call('lead',{name:'Тест',contact:'@offline_test',consent:1});assert.equal(failed.status,503);assert.equal(failed.data.ok,false);assert.equal(php.readFileAsText('/data/leads.json'),'{"items":');console.log('PASS: lead storage failure returns 503 and preserves original');
let r=await call('nodes_save',{key:'offline-test-only-key',add:JSON.stringify([['Тест',null,1,1,1]]),hide:'[]'});assert.equal(r.data.ok,false);console.log('PASS: invalid node coordinate rejected');
r=await call('nodes_save',{key:'offline-test-only-key',add:JSON.stringify([['Тест',0,0,0,0]]),hide:'["Скрыт"]'});assert.equal(r.data.ok,true);let nodes=JSON.parse(php.readFileAsText('/data/nodes.json'));assert.equal(nodes.add[0][3],0);assert.equal(nodes.hide[0],'Скрыт');console.log('PASS: node zero values and hidden list persist');
php.mkdir('/data/content.json');r=await call('content_save',{key:'offline-test-only-key',content:{a:1}});assert.equal(r.status,503);assert.equal(r.data.ok,false);console.log('PASS: failed admin content write returns 503');

process.exit(0);
