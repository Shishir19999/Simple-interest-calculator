/* Small constructors that keep calculator definitions short. */

// Stats (result tiles). k = kind of value: money | num | int | pct | text | date
export const money = (label, v, o = {}) => ({ label, v, k: 'money', ...o });
export const num = (label, v, o = {}) => ({ label, v, k: 'num', ...o });
export const int = (label, v, o = {}) => ({ label, v, k: 'int', ...o });
export const pct = (label, v, o = {}) => ({ label, v, k: 'pct', ...o });
export const text = (label, v, o = {}) => ({ label, v, k: 'text', ...o });

// Inputs
const base = (id, label, def, o) => ({ id, label, def, ...o });
export const fnum = (id, label, def, o = {}) => base(id, label, def, { type: 'number', ...o });
export const fmoney = (id, label, def, o = {}) => base(id, label, def, { type: 'money', min: 0, ...o });
export const frate = (id, label, def, o = {}) => base(id, label, def, { type: 'number', unit: '% p.a.', min: 0, max: 100, step: 0.01, ...o });
export const fpct = (id, label, def, o = {}) => base(id, label, def, { type: 'number', unit: '%', min: 0, max: 100, step: 0.01, ...o });
export const fyears = (id, label, def, o = {}) => base(id, label, def, { type: 'number', unit: 'years', min: 0.1, max: 100, step: 0.5, ...o });
export const fint = (id, label, def, o = {}) => base(id, label, def, { type: 'number', integer: true, step: 1, ...o });
export const fselect = (id, label, options, def, o = {}) => base(id, label, def === undefined ? options[0][0] : def, { type: 'select', options, ...o });
export const ftext = (id, label, def, o = {}) => base(id, label, def, { type: 'text', ...o });
export const farea = (id, label, def, o = {}) => base(id, label, def, { type: 'textarea', rows: 5, ...o });
export const fdate = (id, label, def, o = {}) => base(id, label, def, { type: 'date', ...o });
export const fcheck = (id, label, def, o = {}) => base(id, label, def, { type: 'checkbox', ...o });

export class InputError extends Error {}
export const need = (cond, message) => { if (!cond) throw new InputError(message); };

/** Build a line-chart spec with money values on y. */
export const lineChart = (title, series, o = {}) => ({ type: 'line', title, series, yKind: 'money', xLabel: 'Years', ...o });
