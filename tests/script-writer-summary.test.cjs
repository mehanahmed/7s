const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const modules = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (modules.has(filename)) return modules.get(filename);
  const module = { exports: {} };
  modules.set(filename, module.exports);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), `${name}.ts`))) : require(name),
  }, { filename });
  return module.exports;
}
const { getScriptWriterSummary, scriptActivityStatus, emptyScriptActivityDay } = load('src/lib/script-writer-summary.ts');
const now = new Date('2026-10-17T12:00:00Z');
const range = { from: new Date(2026, 9, 1), to: new Date(2026, 9, 31) };
function fixture({ assignedAt = '2026-10-10T12:00:00Z', complete, status = 'On Script', endDate, writerId = 'writer-1' } = {}) {
  const assignment = { SW: { id: writerId, name: 'Test writer', assignedAt } };
  const project = {
    id: 'test-project', status, createdAt: '2026-09-01T12:00:00Z',
    stageAssignees: assignment, onDesignAt: assignedAt, endDate,
  };
  const order = {
    id: project.id, currentStatus: status === 'On Script' ? 'ready-for-design' : 'script-done',
    stageAssignees: assignment,
    statusHistory: [
      { status: 'ready-for-design', timestamp: assignedAt },
      ...(complete ? [{ status: 'script-done', timestamp: complete }] : []),
    ],
  };
  return { project, order };
}
function summarize(item) {
  return getScriptWriterSummary([item.project], [item.order], 'writer-1', range, now);
}
test('older order assigned this month is included; active work breaches after 48h', () => {
  const result = summarize(fixture());
  assert.equal(result.totalAssigned, 1);
  assert.equal(result.slaBreach, 1);
  assert.equal(result.completed, 0);
});
test('completion at the SLA boundary is on time and remains counted after handover', () => {
  const result = summarize(fixture({ complete: '2026-10-12T12:00:00Z', status: 'On Editor' }));
  assert.equal(result.completed, 1);
  assert.equal(result.onTime, 1);
  assert.equal(result.slaBreach, 0);
});
test('late completion is both completed and an SLA breach', () => {
  const result = summarize(fixture({ complete: '2026-10-12T12:00:01Z', status: 'Script Done' }));
  assert.equal(result.completed, 1);
  assert.equal(result.onTime, 0);
  assert.equal(result.slaBreach, 1);
});
test('active work within 48h is not yet on-time completion or a breach', () => {
  const result = summarize(fixture({ assignedAt: '2026-10-17T00:00:00Z' }));
  assert.equal(result.totalAssigned, 1);
  assert.equal(result.onTime, 0);
  assert.equal(result.slaBreach, 0);
});
test('other writers, cancelled orders, and out-of-range assignments are excluded', () => {
  const cancelled = fixture();
  cancelled.order.currentStatus = 'cancelled';
  for (const item of [cancelled, fixture({ writerId: 'other-writer' }), fixture({ assignedAt: '2026-09-10T00:00:00Z' })]) {
    assert.equal(summarize(item).totalAssigned, 0);
  }
});
test('explicit SW assignment takes precedence over legacy assignment', () => {
  const item = fixture({ writerId: 'other-writer' });
  item.project.designerRepresentativeId = 'writer-1';
  assert.equal(summarize(item).totalAssigned, 0);
});
test('missing assignment dates can use the script-entry history', () => {
  const item = fixture();
  delete item.project.stageAssignees.SW.assignedAt;
  delete item.project.onDesignAt;
  assert.equal(summarize(item).totalAssigned, 1);
});
test('missing/invalid assignment timestamps and empty data are handled safely', () => {
  const item = fixture({ assignedAt: 'invalid' });
  assert.equal(summarize(item).totalAssigned, 0);
  assert.equal(getScriptWriterSummary([], [], 'writer-1', range, now).totalAssigned, 0);
});
test('delivery-window allocation matches the project timer rather than the fallback 48h', () => {
  const item = fixture({ endDate: '2026-09-13T12:00:00Z', complete: '2026-10-11T13:00:00Z', status: 'Script Done' });
  // Twelve-day delivery window allocates one day to the script stage.
  const result = summarize(item);
  assert.equal(result.completed, 1);
  assert.equal(result.slaBreach, 1);
});
test('an old completion is not credited to a reassigned script', () => {
  const item = fixture({ assignedAt: '2026-10-16T12:00:00Z', complete: '2026-10-11T12:00:00Z' });
  item.project.scriptDoneAt = '2026-10-11T12:00:00Z';
  assert.equal(summarize(item).completed, 0);
});

test('project overview uses the same writer and assignment period as the summary', () => {
  const assigned = fixture({ status: 'On Editor', complete: '2026-10-11T12:00:00Z' });
  const otherWriter = fixture({ writerId: 'other-writer' });
  otherWriter.project.id = otherWriter.order.id = 'other-project';
  const oldAssignment = fixture({ assignedAt: '2026-09-10T12:00:00Z' });
  oldAssignment.project.id = oldAssignment.order.id = 'old-project';
  const items = [assigned, otherWriter, oldAssignment];
  const result = getScriptWriterSummary(items.map(item => item.project), items.map(item => item.order), 'writer-1', range, now);
  assert.equal(result.projectCounts['On Editor'], 1);
  assert.equal(result.projectCounts['On Script'], 0);
  assert.equal(Object.values(result.projectCounts).reduce((sum, count) => sum + count, 0), result.totalAssigned);
});

test('daily graph totals match summary counts and empty days are zero-filled', () => {
  const result = summarize(fixture({ complete: '2026-10-11T12:00:00Z', status: 'Script Done' }));
  assert.equal(result.assignmentTrend.length, 31);
  assert.equal(result.assignmentTrend.reduce((sum, point) => sum + point.assigned, 0), result.totalAssigned);
  assert.equal(result.assignmentTrend.reduce((sum, point) => sum + point.completed, 0), result.completed);
  assert.equal(result.assignmentTrend.find(point => point.date === '2026-10-01').assigned, 0);
});

test('longer date ranges aggregate graph data by month', () => {
  const item = fixture({ complete: '2026-10-11T12:00:00Z', status: 'Script Done' });
  const result = getScriptWriterSummary([item.project], [item.order], 'writer-1', { from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) }, now);
  assert.equal(result.assignmentTrend.length, 12);
  assert.equal(result.assignmentTrend.find(point => point.date === '2026-10').assigned, 1);
  assert.equal(result.assignmentTrend.find(point => point.date === '2026-10').completed, 1);
});

test('activity heatmap places completion on the actual completion day', () => {
  const item = fixture({ complete: '2026-10-12T12:00:00Z', status: 'Script Done' });
  const result = summarize(item);
  const assignmentDate = require('date-fns').format(new Date(item.project.onDesignAt), 'yyyy-MM-dd');
  const completionDate = require('date-fns').format(new Date('2026-10-12T12:00:00Z'), 'yyyy-MM-dd');
  assert.equal(result.dailyActivity.find(point => point.date === assignmentDate).assigned, 1);
  assert.equal(result.dailyActivity.find(point => point.date === assignmentDate).completed, 0);
  assert.equal(result.dailyActivity.find(point => point.date === completionDate).completed, 1);
});

test('older assignment completed this month appears in activity without changing summary cohort', () => {
  const result = summarize(fixture({ assignedAt: '2026-09-20T12:00:00Z', complete: '2026-10-12T12:00:00Z', status: 'Script Done' }));
  assert.equal(result.totalAssigned, 0);
  assert.equal(result.completed, 0);
  assert.equal(result.dailyActivity.reduce((sum, point) => sum + point.assigned, 0), 0);
  assert.equal(result.dailyActivity.reduce((sum, point) => sum + point.completed, 0), 1);
});

test('year-long heatmap keeps individual days rather than monthly aggregates', () => {
  const item = fixture();
  const result = getScriptWriterSummary([item.project], [item.order], 'writer-1', { from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) }, now);
  assert.equal(result.dailyActivity.length, 365);
  assert.equal(result.dailyActivity.reduce((sum, point) => sum + point.assigned, 0), 1);
});

test('full-year combined activity supports leap years and includes both metrics on one date', () => {
  const item = fixture({ assignedAt: '2024-02-29T10:00:00Z', complete: '2024-02-29T12:00:00Z', status: 'Script Done' });
  const result = getScriptWriterSummary([item.project], [item.order], 'writer-1', { from: new Date(2024, 0, 1), to: new Date(2024, 11, 31) }, now);
  assert.equal(result.dailyActivity.length, 366);
  const day = result.dailyActivity.find(point => point.date === '2024-02-29');
  assert.equal(day.assigned, 1);
  assert.equal(day.completed, 1);
});

test('annual activity excludes other years while retaining cross-year completions', () => {
  const item = fixture({ assignedAt: '2025-12-30T10:00:00Z', complete: '2026-01-01T12:00:00Z', status: 'Script Done' });
  const result = getScriptWriterSummary([item.project], [item.order], 'writer-1', { from: new Date(2026, 0, 1), to: new Date(2026, 11, 31) }, now);
  assert.equal(result.dailyActivity.reduce((sum, point) => sum + point.assigned, 0), 0);
  assert.equal(result.dailyActivity.reduce((sum, point) => sum + point.completed, 0), 1);
});

test('on-time completion receives the green outcome on completion day', () => {
  const result = summarize(fixture({ complete: '2026-10-11T12:00:00Z', status: 'Script Done' }));
  const day = result.dailyActivity.find(point => point.completed === 1);
  assert.equal(day.onTime, 1);
  assert.equal(scriptActivityStatus(day), 'on-time');
});

test('late completion is yellow and the earlier missed deadline date is red', () => {
  const result = summarize(fixture({ complete: '2026-10-14T12:00:00Z', status: 'Script Done' }));
  const completion = result.dailyActivity.find(point => point.completed === 1);
  assert.equal(completion.slaBreach, 1);
  assert.equal(scriptActivityStatus(completion), 'sla-breach');
  assert.equal(result.dailyActivity.filter(point => scriptActivityStatus(point) === 'missed').length, 1);
});

test('overdue unfinished script marks the missed date while ordinary empty days stay blank', () => {
  const result = summarize(fixture());
  assert.equal(result.dailyActivity.filter(point => point.missed > 0).length, 1);
  assert.equal(scriptActivityStatus(result.dailyActivity.find(point => point.date === '2026-10-01')), 'no-activity');
});

test('gap shading applies only while assigned work is pending without recorded activity', () => {
  const result = summarize(fixture({ complete: '2026-10-12T12:00:00Z', status: 'Script Done' }));
  const gap = result.dailyActivity.find(point => point.date === '2026-10-11');
  assert.equal(scriptActivityStatus(gap), 'gap');
  assert.equal(scriptActivityStatus(result.dailyActivity.find(point => point.date === '2026-10-13')), 'no-activity');
});

test('missed deadlines and late completions take priority over green on mixed days', () => {
  const day = emptyScriptActivityDay('2026-10-12');
  day.onTime = 2;
  day.slaBreach = 1;
  assert.equal(scriptActivityStatus(day), 'sla-breach');
  day.missed = 1;
  assert.equal(scriptActivityStatus(day), 'missed');
});

test('SLA breach before the deadline day ends is yellow, then red after the day is missed', () => {
  const item = fixture();
  const result = getScriptWriterSummary([item.project], [item.order], 'writer-1', range, new Date('2026-10-12T13:00:00Z'));
  const day = result.dailyActivity.find(point => point.slaBreach > 0);
  assert.ok(day);
  assert.equal(scriptActivityStatus(day), 'sla-breach');
  assert.equal(result.dailyActivity.some(point => point.missed > 0), false);
});

