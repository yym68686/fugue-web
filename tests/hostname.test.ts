import assert from "node:assert/strict";
import test from "node:test";

import { normalizeHostname } from "@/lib/fugue/hostname";

test("bare hostnames pass through lowercased and trimmed", () => {
  assert.equal(normalizeHostname("app.example.com"), "app.example.com");
  assert.equal(normalizeHostname("  app.example.com  "), "app.example.com");
  assert.equal(normalizeHostname("App.Example.COM"), "app.example.com");
});

test("a pasted URL is reduced to its hostname", () => {
  assert.equal(normalizeHostname("https://app.example.com"), "app.example.com");
  assert.equal(normalizeHostname("http://app.example.com/"), "app.example.com");
  assert.equal(
    normalizeHostname("https://app.example.com/some/path?q=1#frag"),
    "app.example.com",
  );
});

test("port, userinfo and the root trailing dot are dropped", () => {
  assert.equal(normalizeHostname("app.example.com:8443"), "app.example.com");
  assert.equal(normalizeHostname("https://user:pw@app.example.com"), "app.example.com");
  assert.equal(normalizeHostname("app.example.com."), "app.example.com");
});

test("a path containing @ or : is not mistaken for userinfo or a port", () => {
  assert.equal(normalizeHostname("https://app.example.com/u/@handle"), "app.example.com");
  assert.equal(normalizeHostname("https://app.example.com/a:b"), "app.example.com");
});

test("input with nothing usable normalizes to empty", () => {
  for (const value of ["", "   ", "https://", "/just/a/path"]) {
    assert.equal(normalizeHostname(value), "", `expected "" for ${JSON.stringify(value)}`);
  }
});

test("normalization is idempotent", () => {
  for (const value of [
    "https://App.Example.com:8443/path",
    "app.example.com.",
    "user@app.example.com",
  ]) {
    const once = normalizeHostname(value);
    assert.equal(normalizeHostname(once), once, `not idempotent for ${value}`);
  }
});
