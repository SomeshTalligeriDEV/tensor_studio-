import { z } from 'zod';
import { recipientAddress } from './transfers';

const contactSchema = z.object({ name: z.string().trim().min(1).max(40), address: z.string() }).strict();
export type Contact = z.infer<typeof contactSchema>;
export function readContacts(value: string | null): Contact[] {
  try {
    return z.array(contactSchema).max(100).parse(JSON.parse(value || '[]'))
      .map((contact) => ({ ...contact, address: recipientAddress(contact.address) }));
  } catch { return []; }
}
export function upsertContact(contacts: Contact[], name: string, address: string): Contact[] {
  const contact = contactSchema.parse({ name, address: recipientAddress(address) });
  const next = [...contacts.filter((entry) => entry.address !== contact.address), contact];
  if (next.length > 100) throw new Error('You can save up to 100 contacts.');
  return next.sort((a, b) => a.name.localeCompare(b.name));
}
export function recentRecipients(activity: { recipient: string }[]) {
  return [...new Set(activity.map((entry) => entry.recipient))].slice(0, 5);
}
