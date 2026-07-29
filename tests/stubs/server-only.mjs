// Test-only stand-in for the "server-only" package, which throws on import to
// keep server modules out of client bundles. The test runner has no client/server
// boundary, so importing it must be a no-op instead of a hard error.
export {};
