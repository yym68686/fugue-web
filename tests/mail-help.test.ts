import assert from "node:assert/strict";
import test from "node:test";
import { mailAPIExample, mailDNSBelongsToBinding, mailServiceOrigin } from "../lib/fugue/mail-help";
import type { AppMailDNSObservation, AppMailResponse } from "../lib/fugue/console";

test("mail instructions accept only a credential-free HTTPS origin", () => {
  assert.equal(mailServiceOrigin("https://mail.example.test"), "https://mail.example.test");
  for (const value of [undefined, "javascript:alert(1)", "http://mail.example.test", "https://user:secret@mail.example.test", "https://mail.example.test/?token=private", "https://mail.example.test/#private", "https://mail.example.test/other"]) assert.equal(mailServiceOrigin(value), null);
});
test("mail DNS observations are bound to the exact app, host, generation and active intent", () => {
  const binding = { app_id: "fixture-app", hostname: "app.example.test", generation: 4, state: "active" } as AppMailResponse["binding"];
  const dns = { app_id: binding.app_id, hostname: binding.hostname, generation: binding.generation } as AppMailDNSObservation;
  assert.ok(mailDNSBelongsToBinding(dns, binding));
  for (const patch of [{ app_id: "peer-app" }, { hostname: "peer.example.test" }, { generation: 3 }]) assert.equal(mailDNSBelongsToBinding({ ...dns, ...patch }, binding), false);
  assert.equal(mailDNSBelongsToBinding(null, binding), false);
  assert.equal(mailDNSBelongsToBinding(dns, { ...binding, state: "suspended" }), false);
});
test("mail example uses current mailbox, one stable request key, and placeholders instead of secrets", () => {
  const example = mailAPIExample("https://mail.example.test", { id: "fixture-box", address: "support@app.example.test" });
  assert.match(example, /https:\/\/mail\.example\.test\/api\/v1\/send/);
  assert.match(example, /YOUR_MAILBOX_KEY/); assert.match(example, /fixture-box/);
  assert.equal(example.match(/crypto\.randomUUID\(\)/g)?.length, 1);
  assert.match(example, /SAME key/); assert.match(example, /"Idempotency-Key": requestKey/);
  assert.doesNotMatch(example, /fugue\.pro|ep_[A-Za-z0-9]/);
});
