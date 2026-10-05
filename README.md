# Multicycle — quantum code explorer

An interactive Three.js explorer for multivariate multicycle (MM) quantum error-correcting codes and their bicycle, tricycle, toric, and cubic-code subfamilies.

**Open the app:** https://doc.quantumsavory.org/mm-code-explorer/

- Edit cyclic ideals and 2–6 binary generating polynomials independently of the lattice dimension.
- Explore periodic 2D and 3D lattices, or a 4D lattice as consecutive, labeled 3D slices along the fourth axis.
- See exactly one check representative per X/Z translation family, with polynomial colors, distinct qubit blocks, hover identification, and exact support tables.
- Adjust lattice spacing, block separation, and fourth-axis slice spacing; rotate, pan, and zoom the Three.js views.
- Start with seven presets: BB144, TT72, MM486, MM648, 4D toric96, Haah's cubic code at L=4, and the 2D toric code at L=5.

The app is static and runs entirely in the browser. GitHub Actions tests and builds it, then deploys it to GitHub Pages.

## Construction and conventions

The app implements the Koszul construction described in [Mian, Gwilliam, and Krastanov, *Multivariate Multicycle Codes for Complete Single-Shot Decoding*](https://arxiv.org/abs/2601.18879). See also the authors' [code database](https://github.com/QuantumSavory/Multivariate-Multicycle-Codes-For-Complete-Single-Shot-Decoding).

Let

```text
S = F₂[x₁,…,x_D] / ⟨x₁^L₁ − 1,…,x_D^L_D − 1⟩,
q = floor(t/2),      F₁,…,F_t ∈ S.
```

A physical qubit is identified by a q-element subset B of {1,…,t} and a lattice coordinate g. There are `binomial(t,q) × product(L_i)` physical qubits. The number of variables D and the number of polynomials t are independent.

For each monomial with exponent vector e in F_j:

- The X family indexed by a (q−1)-subset R contains `(B = R ∪ {j}, g = +e mod L)` for each j outside R.
- The Z family indexed by a (q+1)-subset T contains `(B = T \ {j}, g = −e mod L)` for each j inside T.

Every displayed representative is anchored at the origin. Adding a common lattice coordinate to its support gives the other members of that family. No translated checks are drawn. Exponents reduce modulo the periods, and coincident monomials cancel over F₂ **before** supports are constructed. Distinct blocks at the same coordinate remain distinct physical qubits.

This fixes a consistent row-support/transpose convention. Publications may reorder or complement block labels, reverse coordinate orientations, or exchange X and Z names. Here a positive polynomial exponent appears in an X support, and its negative appears in the paired Z construction. Binary-matrix tests verify CSS commutation for all translations and recover known logical dimensions.

The UI uses axes `(x,y,z,w)`; four-variable examples written as `(w,x,y,z)` in the manuscript have been consistently renamed. Small within-site block offsets are display aids, not additional lattice coordinates. Lines identify check membership, not local hardware couplings. In 4D, all slices in a check panel share a camera, preserving their left-to-right order as they rotate; support links are drawn only in the actual anchor slice `w=0`.

## Inputs and limits

The ideal field accepts, for example, `x^12 - 1, y^6 - 1` or `I = ⟨x^{12}-1, y^{6}-1⟩`. Generator order is immaterial. Only independent cyclic relations are supported. Period 1 collapses an axis.

Enter one polynomial per line. Examples include `x^3 + y + y^2`, `(1+x)*(1+y)`, implicit multiplication `xy`, integer coefficients reduced modulo 2, and inverse monomial shifts such as `x^-1`. No expression is evaluated as JavaScript.

Interactive limits: 2–4 variables, 2–6 polynomials, periods 1–32, at most 12 fourth-axis slices, 4,096 sites, and 24,576 physical qubits. Code distances in preset names are attributed to the cited literature; the app does not calculate distances or make decoding-performance claims for custom inputs.

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
npm test
npm run build
```

`npm test` verifies polynomial arithmetic, input validation, qubit-block identity, full translated X/Z commutation, and independently calculated binary ranks for published examples, plus five- and six-generator constructions.

For the browser smoke test, start the dev server and install Chromium or use a local installation:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

`APP_URL` can point the same browser checks at a deployed site. The tests cover all presets, dimension views, filters, custom input, validation, camera interaction, spacing, support tables, and mobile overflow. Screenshots are written to ignored `.artifacts/`.

Drag to rotate 3D views; drag to pan 2D views. Scroll to zoom and right-drag to pan. Focus a view and use arrow keys to rotate/pan and `+` / `−` to zoom. Exact supports remain accessible in HTML tables if WebGL is unavailable.

## Deployment

The repository's Pages source is **GitHub Actions**. Pushes to `main` run `.github/workflows/pages.yml`, which tests, builds, and publishes `dist/`. Relative asset paths allow hosting under the repository subpath. No backend or environment secrets are required.

## References

- [MM construction and presets](https://arxiv.org/abs/2601.18879)
- [Bivariate bicycle codes](https://arxiv.org/abs/2308.07915)
- [Haah's cubic code](https://arxiv.org/abs/1101.1962)
- [Toric code](https://arxiv.org/abs/quant-ph/9707021)
- [Three.js](https://threejs.org/)

Application source is MIT licensed. The cited research belongs to its respective authors.
