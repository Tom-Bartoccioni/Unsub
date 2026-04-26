const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MESSAGES_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';

export type Fetcher = typeof fetch;

export type GmailRefreshConfig = {
  clientId: string;
  clientSecret: string;
};

export async function refreshAccessToken(
  config: GmailRefreshConfig,
  refreshToken: string,
  fetcher: Fetcher = fetch,
): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetcher(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail refresh failed: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

type ListedMessage = { id: string; threadId: string };

export async function listMessageIds(
  accessToken: string,
  query: string,
  options: { maxMessages?: number; fetcher?: Fetcher } = {},
): Promise<ListedMessage[]> {
  const fetcher = options.fetcher ?? fetch;
  const cap = options.maxMessages ?? 200;
  const results: ListedMessage[] = [];
  let pageToken: string | undefined;

  while (results.length < cap) {
    const url = new URL(MESSAGES_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('maxResults', String(Math.min(100, cap - results.length)));
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetcher(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail list failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as {
      messages?: ListedMessage[];
      nextPageToken?: string;
    };
    if (data.messages) results.push(...data.messages);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return results.slice(0, cap);
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  threadId: string;
  internalDate: string;
  payload?: GmailPart;
  snippet?: string;
};

export type NormalizedEmail = {
  id: string;
  threadId: string;
  internalDate: Date;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  textBody: string;
  htmlBody: string;
};

export async function getMessage(
  accessToken: string,
  id: string,
  fetcher: Fetcher = fetch,
): Promise<NormalizedEmail> {
  const url = `${MESSAGES_URL}/${encodeURIComponent(id)}?format=full`;
  const res = await fetcher(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail get failed for ${id}: ${res.status} ${text}`);
  }
  const msg = (await res.json()) as GmailMessage;
  return normalize(msg);
}

export function normalize(msg: GmailMessage): NormalizedEmail {
  const headers = msg.payload?.headers ?? [];
  const headerValue = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  const { textBody, htmlBody } = extractBodies(msg.payload);

  return {
    id: msg.id,
    threadId: msg.threadId,
    internalDate: new Date(Number(msg.internalDate)),
    from: headerValue('From'),
    to: headerValue('To'),
    subject: headerValue('Subject'),
    snippet: msg.snippet ?? '',
    textBody,
    htmlBody,
  };
}

function extractBodies(part: GmailPart | undefined): { textBody: string; htmlBody: string } {
  let textBody = '';
  let htmlBody = '';

  const visit = (p: GmailPart | undefined) => {
    if (!p) return;
    const mime = p.mimeType ?? '';
    const data = p.body?.data;
    if (data) {
      const decoded = Buffer.from(data, 'base64url').toString('utf8');
      if (mime === 'text/plain' && !textBody) textBody = decoded;
      else if (mime === 'text/html' && !htmlBody) htmlBody = decoded;
    }
    if (p.parts) for (const child of p.parts) visit(child);
  };

  visit(part);
  return { textBody, htmlBody };
}

export const SUBSCRIPTION_KEYWORDS_QUERY =
  '(invoice OR subscription OR receipt OR renewal OR "confirm your plan") newer_than:90d';
