import type { Profile } from './profile.ts';

export function formatProfileInput(key: keyof Profile, value: string): string {
  if (key === 'state')
    return value
      .replace(/[^a-z]/gi, '')
      .slice(0, 2)
      .toUpperCase();
  if (!['phone', 'document', 'postal_code'].includes(key)) return value;
  const digits = value.replace(/\D/g, '').slice(0, key === 'postal_code' ? 8 : 11);
  if (key === 'postal_code') return digits.replace(/^(\d{5})(\d)/, '$1-$2');
  if (key === 'document')
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const local = digits.slice(2);
  const split = local.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? '-' + local.slice(split) : ''}`;
}

export type PostalAddress = Pick<Profile, 'street' | 'district' | 'city' | 'state'>;
export function parsePostalAddress(data: unknown, cep: string): PostalAddress {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_RESPONSE');
  const row = data as Record<string, unknown>;
  if (row.erro === true || row.erro === 'true') throw new Error('NOT_FOUND');
  if (typeof row.cep !== 'string' || row.cep.replace(/\D/g, '') !== cep)
    throw new Error('INVALID_RESPONSE');
  const fields = [
    ['street', 'logradouro', 160],
    ['district', 'bairro', 100],
    ['city', 'localidade', 100],
    ['state', 'uf', 2],
  ] as const;
  const address = {} as PostalAddress;
  for (const [key, source, limit] of fields) {
    const value = row[source];
    // Reject control characters from the external postal service response.
    // eslint-disable-next-line no-control-regex
    if (typeof value !== 'string' || value.length > limit || /[<>\u0000-\u001f\u007f]/.test(value))
      throw new Error('INVALID_RESPONSE');
    address[key] = value.trim();
  }
  if (
    !address.city ||
    !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(
      address.state,
    )
  )
    throw new Error('INVALID_RESPONSE');
  return address;
}
