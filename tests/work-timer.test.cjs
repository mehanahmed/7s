const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const moduleUnderTest = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/lib/work-timer.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(code, { module: moduleUnderTest, exports: moduleUnderTest.exports, require });
const { emptyWorkTimer, elapsedWorkTime, startWorkTimer, pauseWorkTimer, restoreWorkTimer, formatWorkTime } = moduleUnderTest.exports;

test('start, pause, and resume accumulate only running time', () => {
  let timer = startWorkTimer(emptyWorkTimer(), 1000);
  assert.equal(elapsedWorkTime(timer, 6000), 5000);
  timer = pauseWorkTimer(timer, 6000);
  assert.equal(elapsedWorkTime(timer, 16000), 5000);
  timer = startWorkTimer(timer, 20000);
  assert.equal(elapsedWorkTime(timer, 23000), 8000);
});
test('repeated start does not restart an active timer', () => {
  const timer = startWorkTimer(emptyWorkTimer(), 1000);
  assert.equal(startWorkTimer(timer, 5000), timer);
});
test('restoring a running timer includes time spent away from the page', () => {
  const timer = startWorkTimer(emptyWorkTimer(), 1000);
  const restored = restoreWorkTimer(JSON.stringify(timer), 61000);
  assert.equal(elapsedWorkTime(restored, 61000), 60000);
});
test('restoring a paused timer never adds time spent away', () => {
  const timer = pauseWorkTimer(startWorkTimer(emptyWorkTimer(), 1000), 5000);
  const restored = restoreWorkTimer(JSON.stringify(timer), 100000);
  assert.equal(elapsedWorkTime(restored, 100000), 4000);
});
test('corrupt, missing, negative, and future-start data safely reset', () => {
  for (const raw of [null, '{', '{}', '{"elapsedMs":-5,"startedAt":null}', '{"elapsedMs":0,"startedAt":999999}', '{"elapsedMs":"10","startedAt":null}']) {
    const restored = restoreWorkTimer(raw, 10000);
    assert.equal(restored.elapsedMs, 0);
    assert.equal(restored.startedAt, null);
  }
});
test('reset is paused and zero; clock rollback cannot subtract recorded time', () => {
  assert.equal(elapsedWorkTime(emptyWorkTimer(), 123456), 0);
  assert.equal(elapsedWorkTime({ elapsedMs: 5000, startedAt: 10000 }, 9000), 5000);
});
test('display formats hours, minutes, and seconds (h:m:s)', () => {
  assert.equal(formatWorkTime(0), '00:00:00');
  assert.equal(formatWorkTime(155000), '00:02:35');
  assert.equal(formatWorkTime(3601000), '01:00:01');
  assert.equal(formatWorkTime(24862000), '06:54:22');
});
