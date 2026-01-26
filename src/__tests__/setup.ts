// Disable Lit dev mode warnings in all tests
// By pre-populating the litIssuedWarnings set, Lit will think it already issued the warning

interface GlobalWithLit {
  litIssuedWarnings?: Set<string>;
}

const g = globalThis as unknown as GlobalWithLit;
g.litIssuedWarnings ??= new Set();
g.litIssuedWarnings.add('dev-mode');
