const managementPaths = [
  '/demo/dashboard',
  '/demo/produtos',
  '/demo/custos',
  '/demo/clientes',
  '/demo/vendas',
];

/** Only known application routes may be used as a post-login destination. */
export function returnDestination(raw: string | null, managementOnly = false) {
  const fallback = '/demo/dashboard';
  if (
    !raw ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    /[\\]/.test(raw) ||
    [...raw].some((char) => char.charCodeAt(0) <= 32)
  )
    return fallback;
  try {
    const url = new URL(raw, 'https://app.invalid');
    if (
      url.origin !== 'https://app.invalid' ||
      (!managementPaths.includes(url.pathname) && (managementOnly || url.pathname !== '/conta'))
    )
      return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
