// Disable Lit dev mode warnings in all tests
// By pre-populating the litIssuedWarnings set, Lit will think it already issued the warning
(globalThis as any).litIssuedWarnings ??= new Set();
(globalThis as any).litIssuedWarnings.add('dev-mode');
