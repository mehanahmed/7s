const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AsyncLocalStorage } = require('node:async_hooks');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual session/guard modules with isolated cookie jars and an in-memory
// token store. These tests never connect to MySQL or use real users or secrets.
function setup(overrides = {}) {
  const requests = new AsyncLocalStorage();
  const token = {
    id: 'test-token', family_id: 'test-family', user_id: 'test-user',
    used_at: null, used_ms_ago: 0, revoked_at: null, valid: 1,
    ...overrides,
  };
  let rotations = 0;
  let revocations = 0;
  const query = async (sql) => {
    if (sql.startsWith('CREATE TABLE')) return {};
    if (sql.startsWith('SELECT id, family_id')) return [{ ...token }];
    if (sql.startsWith('UPDATE refresh_tokens SET used_at')) {
      if (token.used_at) return { affectedRows: 0 };
      token.used_at = new Date();
      return { affectedRows: 1 };
    }
    if (sql.startsWith('UPDATE refresh_tokens SET revoked_at')) {
      revocations++;
      token.revoked_at = new Date();
      return { affectedRows: 1 };
    }
    if (sql.startsWith('SELECT id FROM users')) return overrides.missingUser ? [] : [{ id: token.user_id }];
    if (sql.startsWith('SELECT role FROM users')) return overrides.missingUser ? [] : [{ role: 'DR' }];
    if (sql.startsWith('INSERT INTO refresh_tokens')) { rotations++; return {}; }
    throw new Error(`Unexpected test query: ${sql}`);
  };
  function load(relativePath, dependencies) {
    const source = readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require: (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
      Buffer, console,
      process: { env: { JWT_SECRET: 'isolated-test-signing-key-only', NODE_ENV: 'test' } },
    }, { filename: relativePath });
    return module.exports;
  }
  const nextHeaders = {
    cookies: async () => requests.getStore(),
    headers: async () => new Map([['next-action', 'test-action']]),
  };
  const session = load('src/lib/session-core.ts', { 'next/headers': nextHeaders, '@/lib/mysql': { query } });
  const guard = load('src/lib/guard.ts', {
    'next/headers': nextHeaders, '@/lib/mysql': { query }, '@/lib/session-core': session,
  });
  function jar(hasRefresh = true) {
    const values = new Map(hasRefresh ? [['sv-refresh', 'test-refresh-cookie']] : []);
    const writes = [];
    return {
      get: (name) => values.has(name) ? { value: values.get(name) } : undefined,
      set: (name, value, options) => { values.set(name, value); writes.push({ name, options }); },
      writes,
    };
  }
  return {
    session, guard, jar,
    run: (cookies, action) => requests.run(cookies, action),
    rotations: () => rotations,
    revocations: () => revocations,
  };
}

test('parallel dashboard actions renew their own identity, with one refresh rotation', async () => {
  const env = setup();
  const jars = [env.jar(), env.jar()];
  const scopes = await Promise.all(jars.map(jar => env.run(jar, async () => {
    await env.guard.guard();
    return env.guard.getActionScope();
  })));
  for (const scope of scopes) {
    assert.equal(scope.userId, 'test-user');
    assert.equal(scope.role, 'DR');
  }
  assert.equal(env.rotations(), 1);
  assert.equal(jars.flatMap(jar => jar.writes).filter(write => write.name === 'sv-refresh').length, 1);
  for (const jar of jars) {
    assert.ok(jar.writes.some(write => write.name === 'sv-access' && write.options.httpOnly));
  }
});

test('a recently consumed refresh token restores access without rotating again', async () => {
  const env = setup({ used_at: new Date(), used_ms_ago: 100 });
  await env.run(env.jar(), async () => {
    assert.equal(await env.session.rotateRefresh(), 'retry');
    assert.equal(await env.session.getSessionUserId(), 'test-user');
    const scope = await env.guard.getActionScope();
    assert.equal(scope.userId, 'test-user');
  });
  assert.equal(env.rotations(), 0);
});

test('reuse beyond the grace period revokes the family and grants no access', async () => {
  const env = setup({ used_at: new Date(), used_ms_ago: 10001 });
  const jar = env.jar();
  await env.run(jar, async () => assert.equal(await env.session.rotateRefresh(), 'invalid'));
  assert.equal(env.revocations(), 1);
  assert.equal(jar.writes.length, 0);
});

for (const [name, overrides] of [
  ['expired', { valid: 0 }],
  ['revoked', { revoked_at: new Date() }],
  ['deleted user', { missingUser: true }],
]) {
  test(`${name} session cannot pass guard or receive access cookies`, async () => {
    const env = setup(overrides);
    const jar = env.jar();
    await env.run(jar, async () => {
      await assert.rejects(env.guard.guard(), /Unauthorized/);
      await assert.rejects(env.guard.getActionScope(), /Unauthorized/);
    });
    assert.equal(jar.writes.length, 0);
  });
}

test('missing session does not fall back to unrestricted browser scope', async () => {
  const env = setup();
  await env.run(env.jar(false), async () => {
    await assert.rejects(env.guard.guard(), /Unauthorized/);
    await assert.rejects(env.guard.getActionScope(), /Unauthorized/);
  });
});

test('a deleted identity cannot fall back to unrestricted browser scope', async () => {
  const state = {};
  const env = setup(state);
  const jar = env.jar();
  await env.run(jar, async () => {
    await env.guard.guard();
    state.missingUser = true;
    await assert.rejects(env.guard.getActionScope(), /Unauthorized/);
  });
});
