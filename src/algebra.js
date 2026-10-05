/** Binary group algebra and Koszul checks. No eval or symbolic-code execution. */
export const AXES = ['x', 'y', 'z', 'w'];
export const mod = (n, m) => ((n % m) + m) % m;
export const choose = (n, k) => k < 0 || k > n ? 0 : subsets(n, k).length;
export function subsets(n, k, start = 0, prefix = []) {
  if (!k) return [prefix];
  const out = [];
  for (let i = start; i <= n - k; i++) out.push(...subsets(n, k - 1, i + 1, [...prefix, i]));
  return out;
}
export const blockLabel = b => b.length ? `{${b.map(i => i + 1).join(',')}}` : '∅';
function normalizePowers(source) {
  const normalized = source.replace(/\^\{(-?\d+)\}/g, '^$1');
  if (/[{}]/.test(normalized)) throw new Error('Use balanced braces only around an integer exponent, such as x^{2}.');
  return normalized;
}
export function parseIdeal(source, dimension) {
  let s = normalizePowers(source.trim().replace(/^I\s*=\s*/i, '').replace(/\s/g, '').replace(/−/g, '-'));
  if (/[⟨⟩<>]/.test(s)) {
    if (!/^(?:⟨[^⟨⟩<>]+⟩|<[^⟨⟩<>]+>)$/.test(s)) throw new Error('The ideal must have matching outer angle brackets.');
    s = s.slice(1, -1);
  }
  const parts = s.split(',');
  if (parts.length !== dimension) throw new Error(`The ideal needs ${dimension} cyclic generators, one for each of ${AXES.slice(0, dimension).join(', ')}.`);
  const periods = Array(dimension).fill(null);
  for (const part of parts) {
    const match = /^([xyzw])(?:\^\{?(\d+)\}?)?[-+]1$/.exec(part);
    if (!match || !AXES.slice(0, dimension).includes(match[1])) throw new Error('Use cyclic generators such as x^6 - 1, y^4 - 1 (one per axis).');
    const index = AXES.indexOf(match[1]);
    if (periods[index] !== null) throw new Error(`The ${match[1]} axis is repeated in the ideal.`);
    const value = Number(match[2] ?? 1);
    if (value < 1 || value > 32) throw new Error('Each period must be between 1 and 32. Period 1 collapses an axis.');
    periods[index] = value;
  }
  if (dimension === 4 && periods[3] > 12) throw new Error('Use at most 12 slices along w for this visualizer.');
  if (periods.reduce((a, b) => a * b, 1) > 4096) throw new Error('Use a lattice with at most 4,096 sites for interactive rendering.');
  return periods;
}
export function parsePolynomial(source, periods) {
  if (source.length > 2048) throw new Error('Keep each polynomial below 2,048 characters.');
  const input = normalizePowers(source.replace(/−/g, '-').replace(/\s/g, ''));
  const tokens = input.match(/\d+|[xyzw()+*^\-]/g) ?? [];
  if (tokens.join('') !== input || !input) throw new Error('Use x, y, z, w, integer coefficients, +, -, *, ^ and parentheses.');
  let at = 0, work = 0;
  const zero = periods.map(() => 0).join(',');
  const one = () => new Map([[zero, periods.map(() => 0)]]);
  const xor = (a, b) => { const c = new Map(a); for (const [k, v] of b) c.has(k) ? c.delete(k) : c.set(k, v); return c; };
  const multiply = (a, b) => {
    const c = new Map();
    for (const av of a.values()) for (const bv of b.values()) {
      if (++work > 300000) throw new Error('This expression is too large to expand interactively.');
      const v = av.map((e, i) => mod(e + bv[i], periods[i])), k = v.join(',');
      c.has(k) ? c.delete(k) : c.set(k, v);
    }
    return c;
  };
  const integer = () => {
    const tok = tokens[at++];
    if (!/^\d+$/.test(tok ?? '') || Number(tok) > 1000000) throw new Error('Use integer coefficients and exponents of at most 1,000,000.');
    return Number(tok);
  };
  const primary = () => {
    let result;
    const tok = tokens[at++];
    if (tok === '(') {
      result = sum();
      if (tokens[at++] !== ')') throw new Error('A closing parenthesis is missing.');
    } else if (AXES.includes(tok)) {
      const axis = AXES.indexOf(tok);
      if (axis >= periods.length) throw new Error(`${tok} is not an axis of this ${periods.length}D lattice.`);
      const exp = periods.map(() => 0); exp[axis] = mod(1, periods[axis]); result = new Map([[exp.join(','), exp]]);
    } else if (/^\d+$/.test(tok ?? '')) { at--; result = integer() % 2 ? one() : new Map(); }
    else throw new Error(`Expected a monomial or parenthesis near “${tok ?? 'end of expression'}”.`);
    if (tokens[at] === '^') {
      at++; let sign = 1;
      if (tokens[at] === '-') { sign = -1; at++; }
      let n = integer();
      if (sign < 0) {
        if (result.size !== 1) throw new Error('Negative powers are supported only for monomials.');
        const exp = [...result.values()][0].map((e, i) => mod(-e, periods[i])); result = new Map([[exp.join(','), exp]]);
      }
      let power = one();
      while (n) { if (n % 2) power = multiply(power, result); n = Math.floor(n / 2); if (n) result = multiply(result, result); }
      result = power;
    }
    return result;
  };
  const product = () => {
    let result = primary();
    while (at < tokens.length && !['+', '-', ')'].includes(tokens[at])) {
      if (tokens[at] === '*') at++;
      result = multiply(result, primary());
    }
    return result;
  };
  const sum = () => {
    if (tokens[at] === '+' || tokens[at] === '-') at++;
    let result = product();
    while (tokens[at] === '+' || tokens[at] === '-') { at++; result = xor(result, product()); }
    return result;
  };
  const result = sum();
  if (at !== tokens.length) throw new Error('Unexpected closing parenthesis or trailing expression.');
  return [...result.values()].sort((a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
}
export function monomial(exp) {
  return exp.map((e, i) => !e ? '' : `${AXES[i]}${e === 1 ? '' : `^${e}`}`).filter(Boolean).join('·') || '1';
}
export function buildCode({dimension, ideal, polynomials}) {
  if (![2, 3, 4].includes(Number(dimension))) throw new Error('Choose a 2D, 3D or 4D lattice.');
  const periods = parseIdeal(ideal, Number(dimension));
  const sources = (Array.isArray(polynomials) ? polynomials : polynomials.split('\n')).map(s => s.trim()).filter(Boolean);
  if (sources.length < 2 || sources.length > 6) throw new Error('Enter 2 to 6 generating polynomials, one per line.');
  const polys = sources.map((source, i) => { try { return parsePolynomial(source, periods); } catch (e) { throw new Error(`F${i + 1}: ${e.message}`); } });
  const t = polys.length, q = Math.floor(t / 2), blocks = subsets(t, q);
  const volume = periods.reduce((a, b) => a * b, 1), n = volume * blocks.length;
  if (n > 24576) throw new Error('Use at most 24,576 physical qubits for interactive rendering.');
  const checks = [];
  for (const type of ['X', 'Z']) for (const family of subsets(t, type === 'X' ? q - 1 : q + 1)) {
    const support = [];
    for (let j = 0; j < t; j++) {
      if ((type === 'X') === family.includes(j)) continue;
      const block = type === 'X' ? [...family, j].sort((a,b) => a-b) : family.filter(i => i !== j);
      const blockIndex = blocks.findIndex(b => b.join(',') === block.join(','));
      for (const exp of polys[j]) support.push({block: blockIndex, polynomial: j, exp, coords: exp.map((e, i) => mod(type === 'X' ? e : -e, periods[i]))});
    }
    checks.push({id: `${type}-${family.join('-') || 'empty'}`, type, family, label: `${type}${blockLabel(family)}`, support, weight: support.length});
  }
  return {dimension: Number(dimension), periods, sources, polys, t, q, blocks, volume, n, checks};
}
