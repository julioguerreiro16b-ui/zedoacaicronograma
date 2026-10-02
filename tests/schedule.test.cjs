const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../schedule-core.js');
const source = require('../cronograma_loja.json');
const single = (id, start='2026-10-01') => ({...source, inicio_acompanhamento:start, tarefas:source.tarefas.filter(t=>t.id===id)});
test('rotina semanal mantém segunda/quarta/sexta e terça/quinta, sem duplicar a ocorrência', () => {
  const src=single('SEM-SQF-001','2026-10-05');
  assert.deepEqual(S.entries(src,'2026-10-05').map(t=>t.scheduledDate),['2026-10-05']);
  assert.deepEqual(S.entries(src,'2026-10-06').map(t=>t.scheduledDate),['2026-10-05']);
  assert.deepEqual(S.entries(src,'2026-10-07').map(t=>t.scheduledDate),['2026-10-05','2026-10-07']);
  assert.equal(S.status(S.entries(src,'2026-10-06')[0],'2026-10-06'),'overdue');
  const done={'SEM-SQF-001|2026-10-05':{done:true}};
  assert.deepEqual(S.entries(src,'2026-10-07',done).map(t=>t.scheduledDate),['2026-10-07']);
  assert.equal(S.entries(single('SEM-TQ-001','2026-10-05'),'2026-10-05').length,0);
  assert.equal(S.entries(single('SEM-TQ-001','2026-10-05'),'2026-10-06').length,1);
});
test('mensal permanece após semana e virada de mês até concluir cada ocorrência', () => {
  const src=single('MEN-S1-001');
  const oct=S.entries(src,'2026-10-03')[0];
  assert.equal(S.status(oct,'2026-10-03'),'scheduled');
  assert.equal(S.entries(src,'2026-10-20')[0].key,oct.key);
  assert.equal(S.status(oct,'2026-10-20'),'overdue');
  assert.equal(S.entries(src,'2026-11-01').length,2);
  assert.equal(S.entries(src,'2026-11-01',{[oct.key]:{done:true}}).length,1);
  assert.equal(S.entries(src,'2026-10-20',{[oct.key]:{done:true}}).length,0);
});
test('quinzenal antecipa a primeira janela e destaca semanas 2 e 4 sem apagar atrasos', () => {
  const src=single('QUI-S24-001');
  const early=S.entries(src,'2026-10-02');
  assert.equal(early.length,1);assert.equal(S.status(early[0],'2026-10-02'),'upcoming');
  assert.equal(S.status(early[0],'2026-10-08'),'scheduled');
  assert.equal(S.status(early[0],'2026-10-15'),'overdue');
  const later=S.entries(src,'2026-10-22');
  assert.equal(later.length,2);assert.equal(S.status(later[1],'2026-10-22'),'scheduled');
  assert.equal(S.entries(src,'2026-10-22',{[early[0].key]:{done:true}}).length,1);
});
test('diárias respeitam dias configurados e mantêm conclusão só naquele dia', () => {
  const src=single('DIA-FEC-003');src.tarefas=[{...src.tarefas[0],dias_semana:['segunda']}];
  assert.equal(S.entries(src,'2026-10-06').length,0);
  const list=S.entries(src,'2026-10-05',{'DIA-FEC-003|2026-10-05':{done:true}});
  assert.equal(list.length,1);
});
test('migração preserva registros antigos e pede conferência de conclusões sem nome', () => {
  const raw={schema:1,records:{'MEN-S1-001|2026-10|S1':{done:true,owner:'Ana',date:'2026-10-03',completedAt:'2026-10-03T12:00:00Z'}}};
  const migrated=S.clean(source,raw).records['MEN-S1-001|2026-10|S1'];
  assert.equal(migrated.scheduledDate,'2026-10-01');assert.equal(migrated.done,true);
  raw.records['MEN-S1-001|2026-10|S1'].owner=' ';
  assert.equal(S.clean(source,raw).records['MEN-S1-001|2026-10|S1'].done,false);
});
test('validação rejeita nome vazio, data e semana impossíveis', () => {
  const r={done:true,owner:' ',date:'2026-10-02',scheduledDate:'2026-10-02',completedAt:'2026-10-02T12:00:00Z'};
  assert.throws(()=>S.normalizeRecord(source,'DIA-FEC-003|2026-10-02',r),/nome/);
  assert.equal(S.validDate('2026-02-30'),false);
  assert.throws(()=>S.normalizeRecord(source,'MEN-S1-001|2026-10|S2',{...r,owner:'Ana',scheduledDate:'2026-10-08'}),/Semana/);
});
test('pendências importadas anteriores ao início do acompanhamento continuam visíveis', () => {
  const records={'SEM-TQ-001|2026-10-01':{done:false,scheduledDate:'2026-10-01',date:'2026-10-01'}};
  assert.ok(S.entries(source,'2026-10-02',records).some(t=>t.key==='SEM-TQ-001|2026-10-01'));
});
