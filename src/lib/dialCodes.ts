import { COUNTRY_DATA } from './countries';

/** Dial codes for the phone sign-in picker: every country (anyone can also type a full +number). */
export const DIAL_CODES: [string, string][] = COUNTRY_DATA.map(([, name, dial]) => [name, dial]);

/** Normalise to E.164: keep digits, ensure a leading + and a country code. */
export function toE164(dialCode: string, number: string): string {
  const digits = number.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return '+' + digits.slice(1).replace(/\D/g, '');
  return dialCode + digits.replace(/^0+/, '');
}
