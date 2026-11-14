/** Common dial codes for the phone sign-in picker (anyone can also type a full +number). */
export const DIAL_CODES: [string, string][] = [
  ['🇳🇬 Nigeria', '+234'], ['🇬🇭 Ghana', '+233'], ['🇰🇪 Kenya', '+254'], ['🇿🇦 South Africa', '+27'], ['🇨🇲 Cameroon', '+237'],
  ['🇸🇳 Senegal', '+221'], ['🇨🇮 Côte d\'Ivoire', '+225'], ['🇪🇹 Ethiopia', '+251'], ['🇺🇬 Uganda', '+256'], ['🇹🇿 Tanzania', '+255'],
  ['🇷🇼 Rwanda', '+250'], ['🇪🇬 Egypt', '+20'], ['🇲🇦 Morocco', '+212'], ['🇬🇧 United Kingdom', '+44'], ['🇺🇸 United States / 🇨🇦 Canada', '+1'],
  ['🇮🇪 Ireland', '+353'], ['🇫🇷 France', '+33'], ['🇩🇪 Germany', '+49'], ['🇳🇱 Netherlands', '+31'], ['🇪🇸 Spain', '+34'],
  ['🇮🇹 Italy', '+39'], ['🇵🇹 Portugal', '+351'], ['🇮🇳 India', '+91'], ['🇵🇰 Pakistan', '+92'], ['🇧🇩 Bangladesh', '+880'],
  ['🇦🇪 UAE', '+971'], ['🇸🇦 Saudi Arabia', '+966'], ['🇨🇳 China', '+86'], ['🇯🇵 Japan', '+81'], ['🇰🇷 South Korea', '+82'],
  ['🇵🇭 Philippines', '+63'], ['🇮🇩 Indonesia', '+62'], ['🇲🇾 Malaysia', '+60'], ['🇸🇬 Singapore', '+65'], ['🇹🇭 Thailand', '+66'],
  ['🇻🇳 Vietnam', '+84'], ['🇦🇺 Australia', '+61'], ['🇳🇿 New Zealand', '+64'], ['🇧🇷 Brazil', '+55'], ['🇲🇽 Mexico', '+52'],
  ['🇦🇷 Argentina', '+54'], ['🇨🇴 Colombia', '+57'], ['🇯🇲 Jamaica', '+1'], ['🇹🇷 Turkey', '+90'],
];

/** Normalise to E.164: keep digits, ensure a leading + and a country code. */
export function toE164(dialCode: string, number: string): string {
  const digits = number.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return '+' + digits.slice(1).replace(/\D/g, '');
  return dialCode + digits.replace(/^0+/, '');
}
