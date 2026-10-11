import { parsePostalAddress } from '../domain/profileInput';

export async function fetchPostalAddress(cep: string, signal: AbortSignal) {
  if (!/^\d{8}$/.test(cep)) throw new Error('INVALID_CEP');
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('UNAVAILABLE');
  const body = await response.text();
  if (body.length > 8192) throw new Error('INVALID_RESPONSE');
  return parsePostalAddress(JSON.parse(body), cep);
}
