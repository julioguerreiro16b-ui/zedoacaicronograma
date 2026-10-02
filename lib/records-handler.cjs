const { createHash, timingSafeEqual } = require('node:crypto');
const Schedule = require('../schedule-core.js');
const source = require('../cronograma_loja.json');
const digest = value => createHash('sha256').update(value).digest();
function handler(database, env = process.env) {
  return async function (req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST');
      return send(405, { error: 'Método não permitido.' });
    }
    if (!env.SUPABASE_URL || !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY) || !env.TEAM_ACCESS_CODE || env.TEAM_ACCESS_CODE.length < 6) {
      return send(503, { error: 'O salvamento compartilhado ainda não foi ativado. Os registros continuam neste navegador.', code: 'NOT_CONFIGURED' });
    }
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token || !timingSafeEqual(digest(token), digest(env.TEAM_ACCESS_CODE))) return send(401, { error: 'Informe o código de acesso da loja.', code: 'AUTH_REQUIRED' });
    try {
      if (req.method === 'GET') return send(200, { schema: 2, records: await database.list() });
      let body = req.body;
      if (!body) {
        const chunks = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 16384) return send(413, { error: 'Registro muito grande.' });
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks).toString('utf8');
      }
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > 16384) return send(413, { error: 'Registro muito grande.' });
        try { body = JSON.parse(body); } catch { return send(400, { error: 'Registro inválido.' }); }
      }
      if (!body || typeof body.key !== 'string' || body.key.length > 120 || !Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0 || typeof body.mutationId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.mutationId)) return send(400, { error: 'Registro inválido.' });
      let value;
      try { value = Schedule.normalizeRecord(source, body.key, body.record); }
      catch (error) { return send(400, { error: error.message }); }
      delete value.revision;
      const saved = await database.save(body.key, value, body.baseRevision, body.mutationId);
      if (saved.conflict) return send(409, { error: 'Esta tarefa foi alterada em outro computador. Confira as duas versões.', current: saved.record });
      return send(200, { key: body.key, record: saved.record });
    } catch {
      return send(503, { error: 'Não foi possível acessar os registros da equipe. A alteração local será reenviada.', code: 'UNAVAILABLE' });
    }
  };
}
module.exports = { handler };
