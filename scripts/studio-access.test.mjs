import test from 'node:test';
import assert from 'node:assert/strict';
import { studioAccess } from '../apps/web/server/studio-access.mjs';
const auth = value => `Basic ${Buffer.from(value).toString('base64')}`;
const check = (method, path, header, password = 'correct') => studioAccess(method, path, header, password);
test('only intended GET routes are public', () => {
  for (const path of ['/', '/scan', '/scan/block/12', '/api/market', '/api/chain-config', '/healthz']) assert.equal(check('GET', path), 200);
  for (const path of ['/runner', '/scan-other', '/api/market/private', '/api/runner-session', '/nodes']) assert.equal(check('GET', path), 401);
});
test('other methods require authentication, including HEAD', () => {
  for (const method of ['HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']) {
    assert.equal(check(method, '/scan'), 401);
    assert.equal(check(method, '/scan', auth('studio:correct')), 200);
  }
});
test('protected routes fail closed without password', () => {
  for (const password of ['', undefined, null]) assert.equal(studioAccess('GET', '/runner', auth('studio:correct'), password), 503);
  assert.equal(studioAccess('GET', '/', undefined, undefined), 200);
});
test('only exact owner credentials pass', () => {
  assert.equal(check('GET', '/runner', auth('studio:correct')), 200);
  for (const value of ['studio:wrong', 'other:correct', 'studio:correct:extra', 'studio:', ':correct']) assert.equal(check('GET', '/runner', auth(value)), 401);
});
test('Unicode credentials compare safely and malformed input is rejected', () => {
  assert.equal(check('GET', '/runner', auth('studio:密码🔒'), '密码🔒'), 200);
  assert.equal(check('GET', '/runner', auth('studio:密码'), '密码🔒'), 401);
  for (const value of [undefined, '', 'Bearer xyz', 'Basic !!!', 'Basic /w==', 'Basic A', 'Basic YQ===', 'Basic '+ 'a'.repeat(17000), ['Basic abc']]) assert.equal(check('GET', '/runner', value), 401);
});
