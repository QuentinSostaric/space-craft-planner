/**
 * Shared normalization utilities used across backend modules.
 */

export function normalizeText(value) {
  return String(value ?? '').trim();
}

export function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toIsoNow() {
  return new Date().toISOString();
}

export function normalizeIsoTimestamp(value) {
  const timestamp = String(value ?? '').trim();
  if (!timestamp) {
    return null;
  }

  return Number.isNaN(Date.parse(timestamp)) ? null : timestamp;
}

export function normalizeOrganizationSid(value) {
  const input = normalizeText(value);
  if (!input) {
    return null;
  }

  const urlMatch = input.match(/(?:^|\/)orgs\/([^/?#]+)/i);
  const sid = (urlMatch?.[1] ?? input).trim().toUpperCase();
  return sid || null;
}

export function normalizeBaseUrl(value) {
  const input = normalizeText(value);
  if (!input) {
    return null;
  }

  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return url.origin.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export function readProcessEnv(name) {
  return typeof process !== 'undefined' && process?.env
    ? process.env[name]
    : undefined;
}
