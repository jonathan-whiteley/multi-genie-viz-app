import { describe, it, expect } from 'vitest';
import { parseOboHeaders } from '../obo.js';

describe('parseOboHeaders', () => {
  it('extracts user email + token from Databricks Apps headers', () => {
    const headers = {
      'x-forwarded-email': 'jonathan.whiteley@databricks.com',
      'x-forwarded-user': 'jonathan.whiteley',
      'x-forwarded-access-token': 'eyJ...token...',
    };
    const session = parseOboHeaders(headers);
    expect(session).toEqual({
      email: 'jonathan.whiteley@databricks.com',
      username: 'jonathan.whiteley',
      accessToken: 'eyJ...token...',
    });
  });

  it('returns null when email header missing', () => {
    expect(parseOboHeaders({ 'x-forwarded-access-token': 't' })).toBeNull();
  });

  it('returns null when token header missing', () => {
    expect(parseOboHeaders({ 'x-forwarded-email': 'a@b.com' })).toBeNull();
  });

  it('is case-insensitive on header names', () => {
    const session = parseOboHeaders({
      'X-Forwarded-Email': 'a@b.com',
      'X-Forwarded-Access-Token': 't',
    });
    expect(session?.email).toBe('a@b.com');
  });
});
