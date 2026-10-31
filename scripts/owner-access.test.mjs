import test from 'node:test';
import assert from 'node:assert/strict';
import { createOwnerCookie, ownerCookieValid } from '../apps/web/server/owner-access.mjs';
import { studioAccess } from '../apps/web/server/studio-access.mjs';
const now = 1793400000000;
test('owner cookie grants execution access and has secure browser attributes', () => {
 const cookie = createOwnerCookie('private-password',now);
 assert.ok(cookie.includes('HttpOnly; Secure; SameSite=Strict'));
 assert.equal(ownerCookieValid(cookie,'private-password',now),true);
 assert.equal(studioAccess('GET','/api/runner-connection',undefined,'private-password',createOwnerCookie('private-password')),200);
});
test('expired, tampered and rotated cookies fail closed', () => {
 const cookie = createOwnerCookie('private-password',now);
 assert.equal(ownerCookieValid(cookie,'private-password',now+8*60*60*1000),false);
 assert.equal(ownerCookieValid(cookie,'different-password',now),false);
 const value = cookie.split(';')[0];
 assert.equal(ownerCookieValid(value.slice(0,-1)+(value.endsWith('0')?'1':'0'),'private-password',now),false);
 for(const bad of [undefined,'','__Host-tensorstudio-owner=bad']) assert.equal(ownerCookieValid(bad,'private-password',now),false);
});
