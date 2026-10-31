import test from 'node:test';
import assert from 'node:assert/strict';
import { studioAccess } from '../apps/web/server/studio-access.mjs';
const auth = value => `Basic ${Buffer.from(value).toString('base64')}`;
const check = (method, path, header, password = 'correct') => studioAccess(method, path, header, password);
test('only intended GET routes are public', () => {
  for (const path of ['/', '/scan', '/scan/block/12', '/api/market', '/api/chain-config', '/healthz', '/playground', '/editor', '/subcreate', '/nodes', '/runner', '/wallet', '/api/models', '/dashboard/1', '/owner', '/api/access']) assert.equal(check('GET', path), 200);
  for (const path of ['/scan-other', '/api/market/private', '/api/runner-session', '/api/runner-connection', '/api/unknown']) assert.equal(check('GET', path), 401);
});
test('write methods outside public AI routes require authentication', () => {
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
    assert.equal(check(method, '/scan'), 401);
    assert.equal(check(method, '/scan', auth('studio:correct')), 200);
  }
});
test('protected routes fail closed without password', () => {
  for (const password of ['', undefined, null]) assert.equal(studioAccess('GET', '/api/runner-connection', auth('studio:correct'), password), 503);
  assert.equal(studioAccess('GET', '/', undefined, undefined), 200);
});
test('only exact owner credentials pass', () => {
  assert.equal(check('GET', '/api/runner-connection', auth('studio:correct')), 200);
  for (const value of ['studio:wrong', 'other:correct', 'studio:correct:extra', 'studio:', ':correct']) assert.equal(check('GET', '/api/runner-connection', auth(value)), 401);
});
test('Unicode credentials compare safely and malformed input is rejected', () => {
  assert.equal(check('GET', '/api/runner-connection', auth('studio:密码🔒'), '密码🔒'), 200);
  assert.equal(check('GET', '/api/runner-connection', auth('studio:密码'), '密码🔒'), 401);
  for (const value of [undefined, '', 'Bearer xyz', 'Basic !!!', 'Basic /w==', 'Basic A', 'Basic YQ===', 'Basic '+ 'a'.repeat(17000), ['Basic abc']]) assert.equal(check('GET', '/api/runner-connection', value), 401);
});

test('bounded AI actions are public; execution sessions remain private', () => {
 for(const p of ['/api/ask','/api/chat','/api/subcreate','/api/enhancer']) assert.equal(check('POST',p),200);
 assert.equal(check('HEAD','/playground'),200);
 assert.equal(check('POST','/api/runner-connection'),401);
});
