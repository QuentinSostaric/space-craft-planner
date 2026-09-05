const SENSITIVE_PROPERTY = /(?:^|_)(?:authorization|cookie|password|secret|token|code|email|query|hash|search)(?:_|$)/iu;
const RAW_ERROR_PROPERTIES = new Set(['error_message', 'message', 'stack', 'stacktrace', 'stack_trace', '$exception_list']);
const URL_PROPERTY = /(?:url|href|referrer|pathname|(?:^|_)path$)/iu;

/** Keep route-level analytics without sending credentials or URL parameters. */
function sanitizeAnalyticsUrl(value: string): string {
  if (value === '$direct' || value === '') return value;
  try {
    const relative = value.startsWith('/') && !value.startsWith('//');
    const url = relative ? new URL(value, 'https://analytics.invalid') : new URL(value);
    if (!['https:', 'http:', 'tauri:'].includes(url.protocol)) return '';
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return relative ? url.pathname : url.toString();
  } catch {
    return '';
  }
}

/**
 * Applies to SDK-generated properties as well as our custom events, including
 * nested $set/$set_once attribution. Never ship raw exception text: desktop
 * errors can contain local file paths and API errors can contain credentials.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> {
  if (depth > 8) return {};
  return Object.fromEntries(Object.entries(properties).flatMap(([key, value]) => {
    if (SENSITIVE_PROPERTY.test(key) || RAW_ERROR_PROPERTIES.has(key.toLowerCase())
      || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      return [];
    }
    if (typeof value === 'string' && URL_PROPERTY.test(key)) {
      return [[key, sanitizeAnalyticsUrl(value)]];
    }
    if (Array.isArray(value)) {
      return [[key, value.map((entry) => (
        entry && typeof entry === 'object'
          ? sanitizeAnalyticsProperties(entry as Record<string, unknown>, depth + 1)
          : entry
      ))]];
    }
    if (value && typeof value === 'object') {
      return [[key, sanitizeAnalyticsProperties(value as Record<string, unknown>, depth + 1)]];
    }
    return [[key, value]];
  }));
}

export function sanitizeAnalyticsEvent<T extends {
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
}>(event: T, publicProjectToken: string): T {
  return {
    ...event,
    properties: {
      ...sanitizeAnalyticsProperties(event.properties),
      // Ingestion needs the public project key. Never retain a token from
      // custom event properties or exception data in its place.
      token: publicProjectToken,
    },
    ...(event.$set && { $set: sanitizeAnalyticsProperties(event.$set) }),
    ...(event.$set_once && { $set_once: sanitizeAnalyticsProperties(event.$set_once) }),
  };
}
