import { h, copyText } from './dom.js';
import { evalProg, view, groupBin } from '../lib/progcalc.js';
import { urlParams } from './form-view.js';
import { loadPref, savePref } from '../core/store.js';

export function mountProgrammer(calc) {
  let bits = Number(urlParams().get('w')) || loadPref('progbits', 32);
  if (![8, 16, 32, 64].includes(bits)) bits = 32;
  let value = 0n;

  const input = h('input', { id: 'prog-input', class: 'smart-input', type: 'text', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Integer expression', placeholder: 'e.g. 0xFF & 0b1010 << 2' });
  const err = h('div', { class: 'smart-live bad', role: 'status', 'aria-live': 'polite' });
  const warn = h('p', { class: 'muted small', 'aria-live': 'polite' });
  const rows = h('dl', { class: 'prog-rows' });
  const grid = h('div', { class: 'bitgrid', role: 'group', 'aria-label': 'Bits. Press a bit to toggle it.' });
  const sizeBtns = [8, 16, 32, 64].map((b) => h('button', { type: 'button', class: 'seg', 'aria-pressed': String(b === bits), onClick: () => { bits = b; savePref('progbits', b); sizeBtns.forEach((x, i) => x.setAttribute('aria-pressed', String([8, 16, 32, 64][i] === b))); update(); } }, `${b}-bit`));

  const row = (label, text, copy = text) => [h('dt', null, label), h('dd', null, h('code', null, text), ' ', h('button', { type: 'button', class: 'btn btn-quiet btn-sm', 'aria-label': `Copy ${label}`, onClick: () => copyText(copy, `${label} copied`) }, 'Copy'))];

  function update() {
    const src = input.value;
    if (!src.trim()) { err.textContent = ''; warn.textContent = ''; value = 0n; } else {
      try { value = evalProg(src, bits); err.textContent = ''; } catch (e) { err.textContent = /Incomplete/.test(e.message) ? '' : e.message; return; }
    }
    const v = view(value, bits);
    warn.textContent = v.overflow ? `The result does not fit in ${bits} bits, so it wraps around (two's complement).` : '';
    rows.replaceChildren(...[
      row('Decimal (unsigned)', v.unsigned.toString()), row('Decimal (signed)', v.signed.toString()),
      row('Hexadecimal', `0x${v.hex}`, v.hex), row('Octal', `0o${v.oct}`, v.oct), row('Binary', groupBin(v.bin), v.bin),
      [h('dt', null, 'Bits set'), h('dd', null, h('code', null, String(v.ones)))],
    ].flat());
    const bitsArr = [...v.bin];
    grid.replaceChildren(...Array.from({ length: bits / 4 }, (_, n) => h('div', { class: 'nibble' }, bitsArr.slice(n * 4, n * 4 + 4).map((b, k) => {
      const pos = bits - 1 - (n * 4 + k);
      return h('button', { type: 'button', class: `bit${b === '1' ? ' on' : ''}`, 'aria-pressed': String(b === '1'), 'aria-label': `Bit ${pos}`, onClick: () => { input.value = `0x${(v.unsigned ^ (1n << BigInt(pos))).toString(16).toUpperCase()}`; update(); } }, b);
    }))));
  }
  const presets = ['0xFF & 0b1010', '1 << 10', '~0', '0xDEADBEEF >> 16', '255 ^ 0x0F', '-1', '(5 + 3) * 2'];
  input.addEventListener('input', update);
  const q = urlParams().get('q'); if (q) input.value = q;
  const page = h('div', { class: 'calc-page' },
    h('section', { class: 'card', 'aria-labelledby': 'panel-title' },
      h('div', { class: 'card-head' }, h('h1', { id: 'panel-title', tabindex: '-1' }, calc.title), h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Word size' }, sizeBtns)),
      h('p', { class: 'muted' }, 'Operators: + - * / % & | ^ ~ << >> (>>> is a logical shift). Numbers: 255, 0xFF, 0b1111, 0o17. The words and, or, xor, not, mod also work. Integers only; division truncates toward zero.'),
      h('div', { class: 'smart-box' }, input, err), warn,
      h('div', { class: 'examples' }, h('span', { class: 'muted small' }, 'Try: '), presets.map((x) => h('button', { type: 'button', class: 'chip', onClick: () => { input.value = x; input.focus(); update(); } }, x))),
      rows),
    h('section', { class: 'card', 'aria-labelledby': 'bits-title' }, h('h2', { id: 'bits-title' }, 'Bit view'), h('p', { class: 'muted small' }, 'Bit 0 is the least significant bit, on the far right.'), grid));
  update();
  return { el: page };
}
