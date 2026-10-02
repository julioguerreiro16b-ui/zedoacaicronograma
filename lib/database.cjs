const { neon } = require('@neondatabase/serverless');
function createDatabase(providedClient) {
  let sql = providedClient, ready;
  function client() {
    if (!sql) sql = neon(process.env.DATABASE_URL);
    return sql;
  }
  async function initialize() {
    if (!ready) ready = client().query(`CREATE TABLE IF NOT EXISTS checklist_records (
      record_key text PRIMARY KEY,
      value jsonb NOT NULL,
      revision integer NOT NULL DEFAULT 1,
      mutation_id text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`).catch(error => { ready = null; throw error; });
    await ready;
  }
  function record(row) { return row ? { ...row.value, revision: row.revision } : null; }
  async function list() {
    await initialize();
    const rows = await client().query('SELECT record_key, value, revision FROM checklist_records');
    return Object.fromEntries(rows.map(row => [row.record_key, record(row)]));
  }
  async function save(key, value, baseRevision, mutationId) {
    await initialize();
    const rows = await client().query(`
      INSERT INTO checklist_records (record_key, value, revision, mutation_id)
      SELECT $1, $2::jsonb, 1, $4
      WHERE $3::integer = 0 OR EXISTS (SELECT 1 FROM checklist_records WHERE record_key = $1)
      ON CONFLICT (record_key) DO UPDATE
      SET value = EXCLUDED.value, revision = checklist_records.revision + 1,
          mutation_id = EXCLUDED.mutation_id, updated_at = now()
      WHERE checklist_records.revision = $3 AND checklist_records.mutation_id <> $4
      RETURNING value, revision, mutation_id`, [key, JSON.stringify(value), baseRevision, mutationId]);
    if (rows.length) return { conflict: false, record: record(rows[0]) };
    const current = await client().query('SELECT value, revision, mutation_id FROM checklist_records WHERE record_key = $1', [key]);
    return { conflict: current[0]?.mutation_id !== mutationId, record: record(current[0]) };
  }
  return { list, save };
}
module.exports = { ...createDatabase(), createDatabase };
