export const profileFields = ['full_name', 'phone', 'document', 'postal_code', 'street', 'address_number', 'complement', 'district', 'city', 'state'] as const;
export type Profile = Record<typeof profileFields[number], string>;
export const emptyProfile: Profile = { full_name: '', phone: '', document: '', postal_code: '', street: '', address_number: '', complement: '', district: '', city: '', state: '' };
export function validCPF(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!/^\d{11}$/.test(digits) || /^(\d)\1+$/.test(digits)) return false;
  return [9, 10].every(length => {
    const sum = [...digits.slice(0, length)].reduce((acc, digit, i) => acc + Number(digit) * (length + 1 - i), 0);
    const check = (sum * 10) % 11;
    return Number(digits[length]) === (check === 10 ? 0 : check);
  });
}
export function validateProfile(profile: Profile): string | null {
  if (profile.full_name.trim().length < 2 || profile.full_name.trim().length > 120) return 'Informe seu nome (2 a 120 caracteres).';
  if (profile.document && !validCPF(profile.document)) return 'Confira os dígitos do CPF.';
  if (profile.phone && !/^\d{10,11}$/.test(profile.phone.replace(/\D/g, ''))) return 'Informe o telefone com DDD.';
  if (profile.postal_code && !/^\d{8}$/.test(profile.postal_code.replace(/\D/g, ''))) return 'Confira o CEP (8 dígitos).';
  if (profile.state && !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(profile.state)) return 'Informe uma UF válida.';
  return null;
}
export function normalizeProfile(profile: Profile): Profile {
  return { ...Object.fromEntries(profileFields.map(key => [key, profile[key].trim()])), phone: profile.phone.replace(/\D/g,''), document: profile.document.replace(/\D/g,''), postal_code: profile.postal_code.replace(/\D/g,''), state: profile.state.trim().toUpperCase() } as Profile;
}
