const {test} = require('node:test');
const assert = require('node:assert/strict');
const {PGlite} = require('@electric-sql/pglite');
const {createLocalDatabase} = require('./local-database.cjs');
const {createDatabase} = require('../lib/database.cjs');
test('adapter envia chave secreta só no cabeçalho de servidor e mantém parâmetros RPC', async()=>{
  const requests=[];
  const db=createDatabase({env:{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test'},fetchImpl:async(url,options)=>{
    requests.push({url:String(url),...options});return {ok:true,json:async()=>({})};
  }});
  await db.list();await db.save('key',{owner:'Ana'},3,'mutation');
  assert.equal(requests[0].url,'https://test.supabase.co/rest/v1/rpc/checklist_list');
  assert.equal(requests[0].headers.apikey,'sb_secret_test');
  assert.equal(requests[0].headers.Authorization,undefined);
  assert.deepEqual(JSON.parse(requests[1].body),{p_key:'key',p_value:{owner:'Ana'},p_base_revision:3,p_mutation_id:'mutation'});
  assert.ok(requests.every(r=>!r.url.includes('secret')));
});
test('adapter aceita chave service_role legada e não expõe erros do provedor',async()=>{
  const db=createDatabase({env:{SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'eyJtest'},fetchImpl:async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer eyJtest');return {ok:false};
  }});
  await assert.rejects(db.list(),/Não foi possível acessar o Supabase/);
});
test('migração bloqueia usuários públicos e permite acesso apenas ao servidor',async()=>{
  const pg=new PGlite();
  try {
    const db=createLocalDatabase(pg);await db.list();
    for(const role of ['anon','authenticated']){
      await pg.exec('SET ROLE '+role);
      await assert.rejects(pg.query('SELECT public.checklist_list()'),/permission denied/);
      await assert.rejects(pg.query('SELECT * FROM public.checklist_records'),/permission denied/);
      await assert.rejects(pg.query("SELECT public.checklist_save('x','{}',0,'x')"),/permission denied/);
      await pg.exec('RESET ROLE');
    }
    await pg.exec('SET ROLE service_role');
    assert.deepEqual((await pg.query('SELECT public.checklist_list() AS data')).rows[0].data,{});
    await pg.exec('RESET ROLE');
  } finally {await pg.close();}
});
