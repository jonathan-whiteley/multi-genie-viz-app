export type Session = {
  email: string;
  username: string;
  accessToken: string;
};

function normalize(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') out[k.toLowerCase()] = v;
  }
  return out;
}

export function parseOboHeaders(
  headers: Record<string, string | string[] | undefined>,
): Session | null {
  const h = normalize(headers);
  const email = h['x-forwarded-email'];
  const accessToken = h['x-forwarded-access-token'];
  const username = h['x-forwarded-user'] ?? email?.split('@')[0] ?? '';
  if (!email || !accessToken) return null;
  return { email, username, accessToken };
}
