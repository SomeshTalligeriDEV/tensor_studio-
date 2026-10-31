import { describe, expect, it } from 'vitest';
import { encodeAddress } from '@polkadot/util-crypto';
import { readContacts, recentRecipients, upsertContact } from './contacts';
const address = encodeAddress(new Uint8Array(32).fill(1), 42);
describe('wallet contacts', () => {
  it('normalizes addresses and updates a contact without duplicates', () => {
    const contacts = upsertContact([], ' Test ', address);
    expect(contacts).toEqual([{ name: 'Test', address }]);
    expect(upsertContact(contacts, 'Renamed', encodeAddress(new Uint8Array(32).fill(1), 0))).toEqual([{ name: 'Renamed', address }]);
    expect(readContacts(JSON.stringify(contacts))).toEqual(contacts);
  });
  it('recovers from corrupt storage and rejects invalid entries', () => {
    expect(readContacts('{')).toEqual([]);
    expect(readContacts('[{"name":"Test","address":"invalid"}]')).toEqual([]);
    expect(() => upsertContact([], '', address)).toThrow();
    expect(() => upsertContact([], 'Test', 'invalid')).toThrow();
  });
  it('keeps the last five distinct recipients in activity order', () => {
    expect(recentRecipients(['a', 'b', 'a', 'c', 'd', 'e', 'f'].map((recipient) => ({ recipient })))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});
