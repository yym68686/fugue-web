import assert from 'node:assert/strict';
import test from 'node:test';
import {sourceSyncView} from '@/lib/fugue/source-sync';
import {createTranslator} from '@/lib/i18n/translate';
const now = Date.parse('2026-01-01T00:01:00Z');
const source = {type: 'github-public', repo_url: 'https://github.com/example/app', repo_branch: 'main'};
const app = {origin_source: source, build_source: source, spec: {replicas: 1}};

test('GitHub binding reports pending first check and retained uploaded build', () => {
 const v = sourceSyncView({...app, build_source:{type:'upload'}},now)!;
 assert.equal(v.waitingForBuild,true); assert.equal(v.tone,'idle');
 assert.equal(sourceSyncView({origin_source:{type:'upload'}},now),null);
});
test('GitHub status distinguishes recent success, stale facts, retries and suspension', () => {
 for (const [status,tone] of [
  [{phase:'ok',last_checked_at:'2026-01-01T00:00:59Z'},'ok'],
  [{phase:'ok',last_checked_at:'2025-12-01T00:00:00Z'},'warn'],
  [{phase:'ok'},'warn'],
  [{phase:'degraded',next_check_at:'2026-01-01T00:05:00Z'},'warn'],
  [{phase:'suspended',needs_user_action:true},'err'],
 ] as const) {
  const v=sourceSyncView({...app,status:{source_sync:status}},now)!;
  assert.equal(v.tone,tone);
  assert.notEqual(createTranslator('zh-CN')(v.label),v.label);
 }
 assert.equal(sourceSyncView({...app,spec:{replicas:0}},now)?.tone,'idle');
});
