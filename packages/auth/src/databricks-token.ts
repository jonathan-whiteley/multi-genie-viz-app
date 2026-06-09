/**
 * Minimal OAuth client_credentials token acquisition for Databricks.
 * Used to mint Lakebase database credentials when running as a Databricks App.
 *
 * Env vars (auto-injected by Databricks Apps platform):
 * - DATABRICKS_CLIENT_ID
 * - DATABRICKS_CLIENT_SECRET
 * - DATABRICKS_HOST
 */

let cachedToken: { token: string; expiresAt: number } | null = null;

const REFRESH_MARGIN_MS = 60_000; // refresh 1 min before expiry

export function isServicePrincipalAuthAvailable(): boolean {
  return !!(
    process.env.DATABRICKS_CLIENT_ID &&
    process.env.DATABRICKS_CLIENT_SECRET &&
    process.env.DATABRICKS_HOST
  );
}

export async function getDatabricksToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - REFRESH_MARGIN_MS) {
    return cachedToken.token;
  }

  const clientId = process.env.DATABRICKS_CLIENT_ID;
  const clientSecret = process.env.DATABRICKS_CLIENT_SECRET;
  const host = process.env.DATABRICKS_HOST;
  if (!clientId || !clientSecret || !host) {
    throw new Error(
      'Missing DATABRICKS_CLIENT_ID, DATABRICKS_CLIENT_SECRET, or DATABRICKS_HOST for OAuth token acquisition',
    );
  }

  const cleanHost = host.replace(/\/$/, '').replace(/^https?:\/\//, '');
  const tokenUrl = `https://${cleanHost}/oidc/v1/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'all-apis',
  });
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OAuth token request failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  if (!json.access_token) {
    throw new Error('OAuth response missing access_token');
  }

  const expiresInMs = (json.expires_in || 3600) * 1000;
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + expiresInMs,
  };

  console.log(
    `[OAuth] Token acquired, expires in ${json.expires_in}s, will refresh in ${
      Math.floor((expiresInMs - REFRESH_MARGIN_MS) / 1000)
    }s`,
  );

  return cachedToken.token;
}
