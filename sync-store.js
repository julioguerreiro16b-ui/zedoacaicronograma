(function (root) {
  'use strict';
  root.createChecklistStore = function ({ source, onChange, onStatus }) {
    const storageKey = 'zedoacai-cronograma-v2', legacyKey = 'zedoacai-cronograma-v1';
    let state = { schema: 2, records: {}, outbox: {}, conflicts: {} }, busy = false, token = '', localWritable = true;
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('zedoacai-records') : null;
    try { token = sessionStorage.getItem('zedoacai-team-code') || ''; } catch {}
    function read() {
      const text = localStorage.getItem(storageKey);
      if (!text) return null;
      const raw = JSON.parse(text), clean = Schedule.clean(source, raw);
      return { ...clean, outbox: raw.outbox || {}, conflicts: raw.conflicts || {} };
    }
    function persist() {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); localWritable = true; channel?.postMessage('changed'); return true; }
      catch { localWritable = false; onStatus('storage-error', 'Não foi possível guardar a cópia local. Exporte os registros antes de fechar.'); return false; }
    }
    function refresh() { if (!localWritable) return; const latest = read(); if (latest) state = latest; }
    function migrate() {
      const previous = read();
      if (previous) { state = previous; return; }
      const old = localStorage.getItem(legacyKey);
      if (!old) return;
      const data = Schedule.clean(source, JSON.parse(old));
      state.records = data.records;
      for (const [key, record] of Object.entries(data.records)) state.outbox[key] = { record, baseRevision: 0, mutationId: crypto.randomUUID() };
      persist();
    }
    try { migrate(); } catch { onStatus('storage-error', 'Não foi possível ler a cópia local. O arquivo anterior foi preservado.'); }
    function changed() { onChange(state.records, state.conflicts); }
    function update(key, record) {
      try { refresh(); } catch {}
      const value = Schedule.normalizeRecord(source, key, record);
      const baseRevision = state.outbox[key]?.baseRevision ?? state.records[key]?.revision ?? 0;
      state.records[key] = value;
      state.outbox[key] = { record: value, baseRevision, mutationId: crypto.randomUUID() };
      const savedLocally = persist(); changed();
      if (savedLocally) onStatus('pending', 'Salvo neste navegador · aguardando envio');
      void sync();
    }
    async function request(method, body) {
      const response = await fetch('/api/records', {
        method, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000)
      });
      const data = await response.json().catch(() => ({ error: 'Compartilhamento indisponível neste endereço.' }));
      return { response, data };
    }
    function failure(response, data) {
      onStatus(response.status === 401 ? 'auth' : 'offline', data.error || 'Sem conexão. Alterações guardadas neste navegador.');
    }
    async function runSync() {
      if (busy) return;
      if (location.protocol === 'file:') { onStatus('local', 'Salvo somente neste navegador. Abra o endereço do site para compartilhar.'); return; }
      busy = true;
      try {
        const remote = await request('GET');
        if (!remote.response.ok) { failure(remote.response, remote.data); return; }
        const clean = Schedule.clean(source, remote.data);
        try { refresh(); } catch {}
        // A fila local é preservada enquanto novas alterações chegam de outros dispositivos.
        state.records = { ...clean.records, ...Object.fromEntries(Object.entries(state.outbox).map(([k, op]) => [k, op.record])) };
        persist(); changed();
        for (const key of Object.keys(state.outbox)) {
          if (state.conflicts[key]) continue;
          const sent = state.outbox[key];
          const result = await request('POST', { key, ...sent });
          try { refresh(); } catch {}
          if (result.response.status === 409) {
            state.conflicts[key] = { current: result.data.current };
          } else if (!result.response.ok) {
            failure(result.response, result.data); return;
          } else if (state.outbox[key]?.mutationId === sent.mutationId) {
            state.records[key] = result.data.record;
            delete state.outbox[key]; delete state.conflicts[key];
          } else if (state.outbox[key]) {
            // O usuário editou novamente durante o envio: próxima versão deriva da confirmação recebida.
            state.outbox[key].baseRevision = result.data.record.revision;
            state.outbox[key].record.revision = result.data.record.revision;
          }
          persist(); changed();
        }
        const conflicts = Object.keys(state.conflicts).length, pending = Object.keys(state.outbox).length;
        onStatus(conflicts ? 'conflict' : pending ? 'pending' : 'synced', conflicts ? 'Há alterações simultâneas para conferir.' : pending ? 'Alterações aguardando envio.' : 'Salvo e sincronizado com a equipe');
      } catch { onStatus('offline', 'Sem conexão com a equipe. Alterações guardadas neste navegador para reenviar.'); }
      finally { busy = false; }
    }
    function sync() {
      // Serializa abas do mesmo navegador; o servidor também compara a versão de cada registro.
      return navigator.locks ? navigator.locks.request('zedoacai-sync', { ifAvailable: true }, lock => lock ? runSync() : undefined) : runSync();
    }
    function resolve(key, useLocal) {
      try { refresh(); } catch {}
      const conflict = state.conflicts[key]; if (!conflict) return;
      if (useLocal) {
        state.outbox[key].baseRevision = conflict.current?.revision || 0;
        state.outbox[key].mutationId = crypto.randomUUID();
      } else {
        if (conflict.current) state.records[key] = conflict.current; else delete state.records[key];
        delete state.outbox[key];
      }
      delete state.conflicts[key]; persist(); changed(); void sync();
    }
    function setToken(value) { token = value.trim(); try { sessionStorage.setItem('zedoacai-team-code', token); } catch {} return sync(); }
    function importData(raw) {
      const imported = Schedule.clean(source, raw);
      try { refresh(); } catch {}
      for (const [key, record] of Object.entries(imported.records)) {
        // Importações não substituem silenciosamente uma conferência já existente.
        if (state.records[key]) {
          const fields = ['done','owner','date','scheduledDate','completedAt'];
          if (fields.every(field => state.records[key][field] === record[field])) continue;
          state.conflicts[key] = { current: state.records[key] };
        }
        state.outbox[key] = { record: { ...record, revision: state.records[key]?.revision || 0 }, baseRevision: state.records[key]?.revision || 0, mutationId: crypto.randomUUID() };
        state.records[key] = state.outbox[key].record;
      }
      persist(); changed(); void sync();
    }
    channel?.addEventListener('message', () => { try { refresh(); changed(); } catch {} });
    window.addEventListener('storage', event => { if (event.key === storageKey) { try { refresh(); changed(); } catch {} } });
    window.addEventListener('online', () => void sync());
    window.addEventListener('focus', () => void sync());
    setInterval(() => { if (!document.hidden) void sync(); }, 10000);
    return { update, resolve, setToken, sync, importData, get records() { return state.records; }, get conflicts() { return state.conflicts; } };
  };
})(globalThis);
