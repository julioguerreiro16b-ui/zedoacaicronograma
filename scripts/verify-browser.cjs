// Integração real: Chrome com dois perfis isolados + API + PostgreSQL local de testes.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const { createLocalDatabase } = require('../tests/local-database.cjs');
const { handler } = require('../lib/records-handler.cjs');
const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sockets = [];
async function connect(url) {
  const ws = new WebSocket(url); sockets.push(ws);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let seq=0;const pending=new Map();
  ws.addEventListener('message',event=>{const result=JSON.parse(event.data);if(pending.has(result.id)){const {resolve,reject,timer}=pending.get(result.id);pending.delete(result.id);clearTimeout(timer);result.error?reject(Error(JSON.stringify(result.error))):resolve(result.result);}});
  return (method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout: '+method));},20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
}
async function until(check, label) {
  for(let i=0;i<100;i++){if(await check())return;await sleep(100);}
  throw Error('Tempo esgotado: '+label);
}
(async()=>{
  const pg=new PGlite();
  const database=createLocalDatabase(pg);
  await database.list();
  const code='teste-local-equipe-123456789';
  const api=handler(database,{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test',TEAM_ACCESS_CODE:code});
  let online=true;
  const allowed=new Set(['index.html','app.js','schedule-core.js','sync-store.js','cronograma_para_imprimir.html','cronograma_para_imprimir.pdf']);
  const server=http.createServer((req,res)=>{
    const file=new URL(req.url,'http://localhost').pathname;
    if(file==='/api/records'){
      if(!online){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Sem conexão de teste.'}));return;}
      return api(req,res);
    }
    const name=file==='/'?'index.html':file.slice(1);
    if(!allowed.has(name)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.pdf')?'application/pdf':'text/html; charset=utf-8');
    res.end(fs.readFileSync(path.join(root,name)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const profile=path.join(root,'.chrome-verificacao','integration-'+process.pid);
  const chrome=spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=0','--user-data-dir='+profile,'--no-first-run','about:blank'],{windowsHide:true,stdio:'ignore'});
  let browser;
  try {
    const portFile=path.join(profile,'DevToolsActivePort');
    await until(()=>fs.existsSync(portFile),'Chrome');
    const [port,endpoint]=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
    browser=await connect('ws://127.0.0.1:'+port+endpoint);
    async function page() {
      const {browserContextId}=await browser('Target.createBrowserContext');
      const {targetId}=await browser('Target.createTarget',{url:'about:blank',browserContextId});
      const call=await connect(`ws://127.0.0.1:${port}/devtools/page/${targetId}`);
      await call('Page.enable');await call('Runtime.enable');
      const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
      await call('Page.navigate',{url:base});
      await until(()=>evaluate('typeof store !== "undefined"'),'painel carregado');
      await evaluate(`document.getElementById('teamCode').value=${JSON.stringify(code)};document.getElementById('syncLogin').dispatchEvent(new Event('submit',{cancelable:true}));`);
      await until(()=>evaluate('document.getElementById("saveNote").textContent.includes("sincronizado")'),'login e sincronização');
      const date=async s=>evaluate(`document.getElementById('date').value=${JSON.stringify(s)};document.getElementById('date').dispatchEvent(new Event('change'));`);
      const owner=async(key,name)=>evaluate(`{const field=document.querySelector('[data-owner="'+${JSON.stringify(key)}+'"]');field.value=${JSON.stringify(name)};field.dispatchEvent(new Event('change',{bubbles:true}));}`);
      const check=async key=>evaluate(`document.querySelector('[data-check="'+${JSON.stringify(key)}+'"]').click()`);
      const sync=async()=>{await until(async()=>{await evaluate('store.sync()');return evaluate('Object.keys(JSON.parse(localStorage.getItem("zedoacai-cronograma-v2")||"{\\"outbox\\":{}}" )).length>0 && Object.keys(JSON.parse(localStorage.getItem("zedoacai-cronograma-v2")).outbox).length===0');},'fila sincronizada');};
      return {call,evaluate,date,owner,check,sync};
    }
    const a=await page(),b=await page();
    await a.date('2026-10-05');await b.date('2026-10-05');
    const key='DIA-FEC-003|2026-10-05';
    await a.check(key);
    assert.equal(await a.evaluate(`document.querySelector('[data-check="${key}"]').checked`),false);
    assert.equal(await a.evaluate(`records[${JSON.stringify(key)}]?.done||false`),false);
    await a.owner(key,'Ana');await a.check(key);await a.sync();
    await b.evaluate('store.sync()');
    await until(()=>b.evaluate(`records[${JSON.stringify(key)}]?.done`),'segundo computador recebeu a tarefa');
    assert.equal(await b.evaluate(`records[${JSON.stringify(key)}].owner`),'Ana');
    console.log('OK: nome obrigatório; conclusão compartilhada entre dois perfis independentes.');

    online=false;
    const offlineKey='DIA-FEC-001|2026-10-05';
    await a.owner(offlineKey,'Bia');await a.check(offlineKey);
    await sleep(300);
    await a.call('Page.reload');await until(()=>a.evaluate('typeof store !== "undefined"'),'recarga offline');
    await a.date('2026-10-05');
    assert.equal(await a.evaluate(`records[${JSON.stringify(offlineKey)}].done`),true);
    online=true;await a.sync();await b.evaluate('store.sync()');
    await until(()=>b.evaluate(`records[${JSON.stringify(offlineKey)}]?.done`),'reenvio offline');
    console.log('OK: alteração offline sobrevive à recarga e chega ao outro computador.');

    const conflictKey='DIA-FEC-002|2026-10-05';
    online=false;
    await a.owner(conflictKey,'Ana');await a.check(conflictKey);
    await b.owner(conflictKey,'Carla');await b.check(conflictKey);
    await sleep(300);online=true;await a.sync();await b.evaluate('store.sync()');
    await until(()=>b.evaluate(`Boolean(conflicts[${JSON.stringify(conflictKey)}])`),'conflito visível');
    assert.equal((await database.list())[conflictKey].owner,'Ana');
    await b.evaluate(`document.querySelector('[data-resolve="${conflictKey}"][data-local="false"]').click()`);
    await b.sync();assert.equal(await b.evaluate(`records[${JSON.stringify(conflictKey)}].owner`),'Ana');
    console.log('OK: duas alterações da mesma tarefa exigem resolução; nenhum registro é sobrescrito silenciosamente.');

    await a.date('2026-10-08');
    const monthKey='MEN-S1-001|2026-10|S1';
    assert.equal(await a.evaluate(`document.querySelector('[data-occurrence="${monthKey}"]').classList.contains('overdue')`),true);
    assert.equal(await a.evaluate(`document.querySelector('[data-occurrence="QUI-S24-001|2026-10|S2"]').classList.contains('scheduled')`),true);
    await a.owner(monthKey,'Davi');await a.check(monthKey);
    assert.equal(await a.evaluate(`Boolean(document.querySelector('[data-check="${monthKey}"]'))`),false);
    await a.sync();await b.date('2026-10-22');await b.evaluate('store.sync()');
    await until(()=>b.evaluate(`Boolean(records[${JSON.stringify(monthKey)}]?.done)`),'mensal sincronizada');
    assert.equal(await b.evaluate(`Boolean(document.querySelector('[data-check="${monthKey}"]'))`),false);
    await b.date('2026-11-01');
    assert.equal(await b.evaluate('Boolean(document.querySelector(\'[data-check="MEN-S1-001|2026-11|S1"]\'))'),true);
    await a.evaluate('document.querySelector("[data-view=history]").click()');
    assert.match(await a.evaluate('document.querySelector("tbody").textContent'),/Davi/);
    await a.evaluate(`document.querySelector('[data-undo="${monthKey}"]').click()`);
    await a.evaluate('document.querySelector("[data-view=today]").click()');
    assert.equal(await a.evaluate(`Boolean(document.querySelector('[data-check="${monthKey}"]'))`),true);
    console.log('OK: destaque por semana, pendências acumuladas, mensal some ao concluir e pode ser reaberta pelo histórico.');

    await a.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    assert.equal(await a.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true);
    fs.writeFileSync(path.join(root,'previa_painel.png'),Buffer.from((await a.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await a.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.equal(await a.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true);
    fs.writeFileSync(path.join(root,'previa_celular.png'),Buffer.from((await a.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    console.log('OK: layout em computador e celular sem rolagem horizontal.');
  } finally {
    if(browser)await browser('Browser.close').catch(()=>{});
    sockets.forEach(s=>s.close());chrome.kill();
    await new Promise(resolve=>server.close(resolve));await pg.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
