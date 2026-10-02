// A chave privilegiada fica somente nesta API, nunca nos arquivos do navegador.
function createDatabase({ env = process.env, fetchImpl = fetch, rpc: providedRpc } = {}) {
  async function rpc(name, params = {}) {
    if (providedRpc) return providedRpc(name, params);
    const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    const url = new URL(env.SUPABASE_URL);
    if (url.protocol !== 'https:') throw Error('O Supabase exige HTTPS.');
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    // As chaves modernas sb_secret usam apenas apikey; as legadas são JWTs.
    if (key?.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
    const response = await fetchImpl(new URL('/rest/v1/rpc/' + name, url), {
      method: 'POST', headers, body: JSON.stringify(params), signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw Error('Não foi possível acessar o Supabase.');
    return response.json();
  }
  return {
    list: () => rpc('checklist_list'),
    save: (key, value, baseRevision, mutationId) => rpc('checklist_save', {
      p_key: key, p_value: value, p_base_revision: baseRevision, p_mutation_id: mutationId
    })
  };
}
module.exports = { ...createDatabase(), createDatabase };
