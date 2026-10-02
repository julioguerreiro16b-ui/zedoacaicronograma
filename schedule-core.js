(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Schedule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const weekdays = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const parse = s => new Date(s + 'T12:00:00Z');
  const iso = d => d.toISOString().slice(0, 10);
  const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parse(s).getTime()) && iso(parse(s)) === s;
  function shift(s, n) { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function monthShift(s, n) { const d = parse(s.slice(0, 7) + '-01'); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); }
  function atWeek(month, week) { return month.slice(0, 7) + '-' + String((week - 1) * 7 + 1).padStart(2, '0'); }
  function cycle(task) { return ['mensal', 'quinzenal'].includes(task.frequencia); }
  function key(task, scheduledDate) {
    return cycle(task) ? `${task.id}|${scheduledDate.slice(0, 7)}|S${Math.ceil(parse(scheduledDate).getUTCDate() / 7)}` : `${task.id}|${scheduledDate}`;
  }
  function entry(task, scheduledDate, availableDate = scheduledDate, deadline = scheduledDate) {
    return { ...task, key: key(task, scheduledDate), scheduledDate, availableDate, deadline };
  }
  function entries(source, selected, records = {}) {
    if (!validDate(selected)) return [];
    const start = source.inicio_acompanhamento < selected ? source.inicio_acompanhamento : selected;
    const result = [];
    for (const task of source.tarefas) {
      if (task.frequencia === 'diaria') {
        if (task.dias_semana.includes(weekdays[parse(selected).getUTCDay()])) result.push(entry(task, selected));
      } else if (task.frequencia === 'semanal') {
        // Cada dia indicado gera sua própria conferência; pendências não vencem.
        for (let date = start; date <= selected; date = shift(date, 1)) {
          if (task.dias_semana.includes(weekdays[parse(date).getUTCDay()])) result.push(entry(task, date));
        }
      } else if (cycle(task)) {
        const weeks = [...task.semanas_mes].sort((a, b) => a - b);
        for (let month = start.slice(0, 7) + '-01'; month <= selected; month = monthShift(month, 1)) {
          weeks.forEach((week, i) => {
            const scheduled = atWeek(month, week);
            const available = i === 0 ? month : scheduled;
            const deadline = [shift(scheduled, 6), shift(monthShift(month, 1), -1)].sort()[0];
            const next = i + 1 < weeks.length ? atWeek(month, weeks[i + 1]) : monthShift(month, 1);
            if (available <= selected && next > start) result.push(entry(task, scheduled, available, deadline));
          });
        }
      }
    }
    // Preserva pendências importadas anteriores ao início do acompanhamento.
    const known = new Set(result.map(t => t.key));
    for (const [recordKey, saved] of Object.entries(records)) {
      const task = source.tarefas.find(t => t.id === recordKey.split('|')[0]);
      if (task && task.frequencia !== 'diaria' && !saved.done && saved.scheduledDate <= selected && !known.has(recordKey)) {
        result.push(entry(task, saved.scheduledDate, saved.scheduledDate, cycle(task) ? shift(saved.scheduledDate, 6) : saved.scheduledDate));
      }
    }
    return result.filter(t => t.frequencia === 'diaria' || !records[t.key]?.done)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate) || source.tarefas.findIndex(t => t.id === a.id) - source.tarefas.findIndex(t => t.id === b.id));
  }
  function status(task, selected) {
    if (task.frequencia === 'diaria') return '';
    if (selected > task.deadline) return 'overdue';
    if (selected >= task.scheduledDate) return 'scheduled';
    return 'upcoming';
  }
  function normalizeRecord(source, recordKey, r, legacy = false) {
    const task = source.tarefas.find(t => t.id === recordKey.split('|')[0]);
    if (!task || !r || typeof r.done !== 'boolean' || typeof r.owner !== 'string' || r.owner.length > 80 || !validDate(r.date)) throw Error('Registro inválido.');
    let scheduled = r.scheduledDate;
    if (legacy) {
      scheduled = cycle(task) ? atWeek(r.date, Number(recordKey.split('|')[2]?.slice(1))) : r.date;
    }
    if (!validDate(scheduled) || recordKey !== key(task, scheduled)) throw Error('Período inválido.');
    if (cycle(task)) {
      if (!task.semanas_mes.includes(Math.ceil(parse(scheduled).getUTCDate() / 7)) || (parse(scheduled).getUTCDate() - 1) % 7 !== 0) throw Error('Semana inválida.');
    } else if (!task.dias_semana.includes(weekdays[parse(scheduled).getUTCDay()])) throw Error('Dia da semana inválido.');
    if (task.frequencia === 'diaria' && r.date !== scheduled) throw Error('Data da tarefa diária inválida.');
    const owner = r.owner.trim();
    // Registros antigos sem autoria ficam pendentes para conferência, nunca recebem nome inventado.
    const done = legacy && !owner ? false : r.done;
    if (done && !owner) throw Error('Informe o nome de quem fez a tarefa.');
    if (done && (typeof r.completedAt !== 'string' || Number.isNaN(Date.parse(r.completedAt)))) throw Error('Horário de conclusão inválido.');
    return { done, owner, date: r.date, scheduledDate: scheduled, completedAt: done ? r.completedAt : null, revision: Number.isSafeInteger(r.revision) && r.revision >= 0 ? r.revision : 0 };
  }
  function clean(source, raw) {
    if (!raw || ![1, 2].includes(raw.schema) || !raw.records || typeof raw.records !== 'object' || Array.isArray(raw.records)) throw Error('Formato de cópia inválido.');
    const records = {};
    for (const [k, r] of Object.entries(raw.records)) records[k] = normalizeRecord(source, k, r, raw.schema === 1);
    return { schema: 2, records };
  }
  return { validDate, shift, cycle, key, entry, entries, status, normalizeRecord, clean };
});
