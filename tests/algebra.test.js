import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCode, parseIdeal, parsePolynomial } from '../src/algebra.js';

// Fixtures are transcribed independently from MM_codes/main.tex. The paper's
// four-variable order (w,x,y,z) is renamed (x,y,z,w) for this application's axes.
const publishedCodes = [
  {
    name: 'BB [[144,12,12]]', dimension: 2, ideal: 'x^12-1, y^6-1',
    polynomials: ['x^3+y+y^2', 'y^3+x+x^2'], n: 144, k: 12,
    weights: { X: [6], Z: [6] },
  },
  {
    name: 'TT [[72,6,(12,6)]]', dimension: 3, ideal: 'x^4-1, y^3-1, z^2-1',
    polynomials: ['1+y+x*y^2', '1+y*z+x^2*y^2', '1+x*y^2*z+x^2*y'], n: 72, k: 6,
    weights: { X: [9], Z: [6] },
  },
  {
    name: '4D toric [[96,6,4]]', dimension: 4, ideal: 'x^2-1,y^2-1,z^2-1,w^2-1',
    polynomials: ['1+x', '1+y', '1+z', '1+w'], n: 96, k: 6,
    weights: { X: [6], Z: [6] },
  },
  {
    name: 'MM [[486,24,12]]', dimension: 4, ideal: 'x^3-1,y^3-1,z^3-1,w^3-1',
    polynomials: ['1+x*y+y^2*z', '1+y*z+z^2*w', '1+z*w+x*w^2', '1+x*w+x^2*y'],
    n: 486, k: 24, weights: { X: [9], Z: [9] },
  },
  {
    name: 'MM [[648,60,9]]', dimension: 4, ideal: 'x^3-1,y^3-1,z^3-1,w^4-1',
    polynomials: ['(1+y)*(1+z*w)', '(1+z)*(1+w*x)', '(1+w)*(1+x*y)', '(1+x)*(1+y*z)'],
    n: 648, k: 60, weights: { X: [12], Z: [12] },
  },
];

function allSites(periods) {
  return periods.reduce((sites, length) => sites.flatMap(site =>
    Array.from({ length }, (_, coordinate) => [...site, coordinate])), [[]]);
}

function qubitIndex(block, coordinates, periods) {
  return coordinates.reduce((index, coordinate, axis) => index * periods[axis] + coordinate, block);
}

// Build every translated binary stabilizer directly from the public supports.
// This intentionally uses neither the application's mod() nor its subsets().
function translatedRows(code, type) {
  return code.checks.filter(check => check.type === type).flatMap(check =>
    allSites(code.periods).map(anchor => {
      let row = 0n;
      for (const entry of check.support) {
        const coordinates = entry.coords.map((coordinate, axis) =>
          (coordinate + anchor[axis]) % code.periods[axis]);
        row ^= 1n << BigInt(qubitIndex(entry.block, coordinates, code.periods));
      }
      return row;
    }));
}

function rank(rows) {
  const pivots = new Map();
  for (let row of rows) {
    while (row) {
      const pivot = row.toString(2).length - 1;
      if (pivots.has(pivot)) row ^= pivots.get(pivot);
      else { pivots.set(pivot, row); break; }
    }
  }
  return pivots.size;
}

function parity(value) {
  let result = 0;
  while (value) { result ^= 1; value &= value - 1n; }
  return result;
}

function verifyMatrices(code, expectedK) {
  const X = translatedRows(code, 'X');
  const Z = translatedRows(code, 'Z');
  for (let i = 0; i < X.length; i++) for (let j = 0; j < Z.length; j++) {
    assert.equal(parity(X[i] & Z[j]), 0, `X row ${i} and Z row ${j} anticommute`);
  }
  const k = code.n - rank(X) - rank(Z);
  assert.ok(k >= 0 && k <= code.n);
  if (expectedK !== undefined) assert.equal(k, expectedK);
}

test('cyclic ideals accept reordered generators, characteristic-two signs, and collapsed axes', () => {
  assert.deepEqual(parseIdeal('I = ⟨ y^6 + 1, x^{12} − 1 ⟩', 2), [12, 6]);
  assert.deepEqual(parseIdeal('x-1,y^2-1,z-1,w^4-1', 4), [1, 2, 1, 4]);
});

test('period reduction and binary addition cancel all coincident monomials', () => {
  assert.deepEqual(parsePolynomial('1+x^4+y^3+x^4*y^3', [4, 3]), []);
  assert.deepEqual(parsePolynomial('x+x+x^5+3y+2xy', [4, 3]), [[0, 1], [1, 0]]);
  assert.deepEqual(parsePolynomial('1-x+y-y', [4, 3]), [[0, 0], [1, 0]]);
  assert.deepEqual(parsePolynomial('1+y', [4, 1]), []);
  assert.deepEqual(parsePolynomial('0', [4, 3]), []);
});

test('products, parentheses, implicit multiplication, and powers expand over F2', () => {
  assert.deepEqual(parsePolynomial('(1+x)(1+y)', [4, 3]), [[0, 0], [0, 1], [1, 0], [1, 1]]);
  assert.deepEqual(parsePolynomial('(x+y)^2', [4, 3]), [[0, 2], [2, 0]]);
  assert.deepEqual(parsePolynomial('x^0 + (1+y)^0', [4, 3]), []);
  assert.deepEqual(parsePolynomial('xy^2 + x*y*y', [4, 3]), []);
  assert.deepEqual(parsePolynomial('(1+x)^4', [4, 3]), []);
  assert.deepEqual(parsePolynomial('x^{1000000}', [3, 2]), [[1, 0]]);
});

test('negative monomial powers mean inverse shifts on the periodic lattice', () => {
  assert.deepEqual(parsePolynomial('x^-1+y^{-2}', [4, 3]), [[0, 1], [3, 0]]);
  assert.deepEqual(parsePolynomial('(x*y^2)^-3', [5, 4]), [[2, 2]]);
  assert.deepEqual(parsePolynomial('x^-1*x+1', [5, 4]), []);
  assert.deepEqual(parsePolynomial('-x + y', [5, 4]), [[0, 1], [1, 0]]);
  assert.throws(() => parsePolynomial('(1+x)^-1', [5, 4]), /monomials/);
  assert.throws(() => parsePolynomial('0^-1', [5, 4]), /monomials/);
});

test('malformed polynomials cannot be silently executed or truncated', () => {
  for (const source of ['', 'x+', 'x**y', '(x+y', 'x+y)', '()', 'x^', 'x^2^3',
    'x/2', 'x.2', 'x=1', 'x++y', 'x^1.5', 'x^1000001', '1000001x',
    'console.log(1)', 'globalThis.process.exit()', 'x;y']) {
    assert.throws(() => parsePolynomial(source, [4, 3]), undefined, source);
  }
  assert.throws(() => parsePolynomial('z', [4, 3]), /not an axis/);
  assert.throws(() => parsePolynomial('x'.repeat(2049), [4, 3]), /2,048/);
});

test('invalid or unsupported ideals fail with actionable messages', () => {
  for (const source of ['x^0-1,y^2-1', 'x^-2-1,y^2-1', 'x^2-1,x^3-1',
    'x^2-1', 'x^2-1,z^2-1', 'x^2-y,y^2-1', 'x^33-1,y^2-1']) {
    assert.throws(() => parseIdeal(source, 2), undefined, source);
  }
  assert.throws(() => parseIdeal('x^2-1,y^2-1,z^2-1,w^13-1', 4), /12 slices/);
  assert.throws(() => parseIdeal('x^32-1,y^32-1,z^32-1', 3), /4,096/);
});

test('bicycle checks retain block identity and opposite transpose shift directions', () => {
  const code = buildCode({ dimension: 2, ideal: 'x^5-1,y^4-1', polynomials: ['x^2+y', '1+x*y^2'] });
  assert.deepEqual(code.blocks, [[0], [1]]);
  assert.deepEqual(code.checks.map(check => [check.type, check.family]), [['X', []], ['Z', [0, 1]]]);
  const points = type => code.checks.find(check => check.type === type).support
    .map(entry => `${entry.block}:${entry.coords.join(',')}`).sort();
  assert.deepEqual(points('X'), ['0:0,1', '0:2,0', '1:0,0', '1:1,2']);
  assert.deepEqual(points('Z'), ['0:0,0', '0:4,2', '1:0,3', '1:3,0']);
  verifyMatrices(code);
});

for (const fixture of publishedCodes) {
  test(`${fixture.name}: full translated checks commute and binary ranks recover published k`, () => {
    const code = buildCode(fixture);
    assert.equal(code.n, fixture.n);
    for (const type of ['X', 'Z']) {
      assert.deepEqual([...new Set(code.checks.filter(check => check.type === type).map(check => check.weight))], fixture.weights[type]);
    }
    verifyMatrices(code, fixture.k);
  });
}

test('a 2D lattice supports a four-polynomial collapsed AMC code', () => {
  const code = buildCode({ dimension: 2, ideal: 'x^16-1,y-1',
    polynomials: ['1+x', '1+x^3', '1+x^5', '1+x^7'] });
  assert.equal(code.t, 4);
  assert.equal(code.q, 2);
  assert.equal(code.blocks.length, 6);
  assert.equal(code.n, 96);
  verifyMatrices(code, 6);
});

for (const t of [5, 6]) {
  test(`${t} arbitrary multivariate generators produce the correct Koszul families and commuting checks`, () => {
    const polynomials = ['1+x', '1+y', '1+x*y', '1+x^2*y', '1+x^2', '1+y+x+x^2'].slice(0, t);
    const code = buildCode({ dimension: 2, ideal: 'x^3-1,y^2-1', polynomials });
    assert.equal(code.q, Math.floor(t / 2));
    assert.equal(code.blocks.length, t === 5 ? 10 : 20);
    assert.equal(code.checks.filter(check => check.type === 'X').length, t === 5 ? 5 : 15);
    assert.equal(code.checks.filter(check => check.type === 'Z').length, t === 5 ? 10 : 15);
    assert.equal(code.n, t === 5 ? 60 : 120);
    verifyMatrices(code);
    // Any invertible monomial generator makes the Koszul complex contractible.
    verifyMatrices(buildCode({ dimension: 2, ideal: 'x^3-1,y^2-1', polynomials: ['x*y', ...polynomials.slice(1)] }), 0);
  });
}

test('zero generators and repeated generators remain valid CSS complexes', () => {
  const code = buildCode({ dimension: 3, ideal: 'x^3-1,y^2-1,z-1',
    polynomials: ['0', '1+z', 'x+y', 'x+y'] });
  assert.deepEqual(code.polys.slice(0, 2), [[], []]);
  verifyMatrices(code);
});

test('configuration validation reports polynomial context and respects rendering limits', () => {
  assert.throws(() => buildCode({ dimension: 1, ideal: 'x^3-1', polynomials: ['x', '1'] }), /2D, 3D or 4D/);
  assert.throws(() => buildCode({ dimension: 2, ideal: 'x^3-1,y^3-1', polynomials: ['x'] }), /2 to 6/);
  assert.throws(() => buildCode({ dimension: 2, ideal: 'x^3-1,y^3-1', polynomials: ['x', 'y+'] }), /F2:/);
  assert.throws(() => buildCode({ dimension: 3, ideal: 'x^16-1,y^16-1,z^16-1', polynomials: Array(6).fill('x') }), /24,576/);
  assert.equal(buildCode({ dimension: 2, ideal: 'x^3-1,y^3-1', polynomials: 'x\n\ny\n' }).t, 2);
});

test('unbalanced exponent braces and ideal delimiters are rejected', () => {
  for (const input of ['x^{2', 'x}^2', '{x}']) assert.throws(() => parsePolynomial(input, [3,3]));
  for (const input of ['<x^3-1,y^3-1', 'x^3-1,y^3-1>', '⟨x^3-1,y^3-1>']) assert.throws(() => parseIdeal(input,2));
  assert.deepEqual(parsePolynomial('x^{2}+y^{-1}',[3,3]), [[0,2],[2,0]]);
});
