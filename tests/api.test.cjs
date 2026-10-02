const {test,before,after} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {PGlite} = require('@electric-sql/pglite');
const {createDatabase} = require('../lib/database.cjs');
const {handler} = require('../lib/records-handler.cjs');
let pg,db;
const env={DATABASE_URL:'postgresql://test',TEAM_ACCESS_CODE:'test-code-long-enough-123456'};
const value={done:true,owner:'Ana',date:'2026-10-02',scheduledDate:'2026-10-02',completedAt:'2026-10-02T12:00:00Z'};
async function request(method,body,token=env.TEAM_ACCESS_CODE,config=env) {
  const req={method,body,headers:{authorization:token?'Bearer '+token:''}};
  let result; const res={headers:{},setHeader(k,v){this.headers[k]=v;},end(text){result={status:this.statusCode,body:JSON.parse(text),headers:this.headers};}};
  await handler(db,config)(req,res);return result;
}
before(async()=>{pg=new PGlite();db=createDatabase({query:async(q,p)=>(await pg.query(q,p)).rows});});
after(async()=>{await pg.close();});
test('API exige acesso e configuração; mensagens não expõem credenciais',async()=>{
  assert.equal((await request('GET',null,'')).status,401);
  assert.equal((await request('GET',null,'wrong')).status,401);
  assert.equal((await request('GET',null,'',{})).status,503);
  assert.equal((await request('DELETE')).status,405);
});
test('Postgres guarda dados e permite leitura em outra instância da API',async()=>{
  const key='DIA-FEC-003|2026-10-02',mutationId=randomUUID();
  const first=await request('POST',{key,record:value,baseRevision:0,mutationId});
  assert.equal(first.status,200);assert.equal(first.body.record.revision,1);
  const second=await request('GET');assert.equal(second.body.records[key].owner,'Ana');
  assert.equal(second.headers['Cache-Control'],'no-store');
  const replay=await request('POST',{key,record:value,baseRevision:0,mutationId});
  assert.equal(replay.status,200);assert.equal(replay.body.record.revision,1);
});
test('alterações concorrentes geram conflito sem perder a versão confirmada',async()=>{
  const key='DIA-FEC-001|2026-10-02';
  const results=await Promise.all(['Ana','Bia'].map(owner=>request('POST',{key,record:{...value,owner},baseRevision:0,mutationId:randomUUID()})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const conflict=results.find(r=>r.status===409);
  assert.equal(conflict.body.current.revision,1);
  const corrected=await request('POST',{key,record:{...value,owner:'Carla'},baseRevision:1,mutationId:randomUUID()});
  assert.equal(corrected.status,200);assert.equal(corrected.body.record.revision,2);
  const other=await request('POST',{key:'DIA-FEC-002|2026-10-02',record:value,baseRevision:0,mutationId:randomUUID()});
  assert.equal(other.status,200);
  const saved=(await request('GET')).body.records;
  assert.equal(saved[key].owner,'Carla');assert.equal(saved['DIA-FEC-002|2026-10-02'].owner,'Ana');
});
test('conclusão sem nome e entrada inválida não chegam ao banco',async()=>{
  const r=await request('POST',{key:'DIA-FEC-003|2026-10-02',record:{...value,owner:'   '},baseRevision:1,mutationId:randomUUID()});
  assert.equal(r.status,400);assert.match(r.body.error,/nome/);
  assert.equal((await request('POST','{bad')).status,400);
  assert.equal((await request('POST',{key:'unknown'})).status,400);
});
