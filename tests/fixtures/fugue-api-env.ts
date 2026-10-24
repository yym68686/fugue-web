import { afterEach, beforeEach } from "node:test";

// Network calls are mocked by each test; never inherit a live backend URL.
export function fugueApiEnv() {
  const previous = new Map<string, string | undefined>();
  beforeEach(() => {
    for (const name of ["FUGUE_API_URL", "FUGUE_INTERNAL_API_URL"]) {
      previous.set(name, process.env[name]);
      process.env[name] = "https://api.example.test";
    }
  });
  afterEach(() => {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    previous.clear();
  });
}
