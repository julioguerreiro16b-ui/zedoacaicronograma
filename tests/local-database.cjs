const fs = require('node:fs');
const path = require('node:path');
const { createDatabase } = require('../lib/database.cjs');
function createLocalDatabase(pg) {
  const ready = (async () => {
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    await pg.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/202610020001_checklist.sql'), 'utf8'));
  })();
  return createDatabase({ rpc: async (name, params) => {
    await ready;
    const result = name === 'checklist_list'
      ? await pg.query('SELECT public.checklist_list() AS data')
      : await pg.query('SELECT public.checklist_save($1, $2::jsonb, $3, $4) AS data', [params.p_key, JSON.stringify(params.p_value), params.p_base_revision, params.p_mutation_id]);
    return result.rows[0].data;
  }});
}
module.exports = { createLocalDatabase };
