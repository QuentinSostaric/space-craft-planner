const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const DOT_SEGMENT_PATTERN = /(?:^|\/)\.{1,2}(?:\/|$)/u;

/**
 * Accept only same-application absolute paths before they reach fetch or a
 * privileged Tauri command. Query strings are allowed; protocol-relative,
 * backslash and dot-segment paths are not.
 */
export function requireInternalPath(path: string): string {
  const trimmedPath = path.trim();
  const pathname = trimmedPath.split(/[?#]/u, 1)[0] ?? '';
  let decodedPathname: string;

  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    throw new TypeError('Expected a valid percent-encoded path.');
  }

  if (
    !trimmedPath.startsWith('/') ||
    trimmedPath.startsWith('//') ||
    decodedPathname.startsWith('//') ||
    /%(?:2f|5c|25)/iu.test(pathname) ||
    decodedPathname.includes('\\') ||
    CONTROL_CHARACTER_PATTERN.test(trimmedPath) ||
    CONTROL_CHARACTER_PATTERN.test(decodedPathname) ||
    DOT_SEGMENT_PATTERN.test(decodedPathname)
  ) {
    throw new TypeError('Expected a safe same-application path.');
  }

  return trimmedPath;
}

/** Keep OAuth return targets inside the single-page application. */
export function sanitizeAppReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value) {
    return fallback;
  }

  try {
    return requireInternalPath(value);
  } catch {
    return fallback;
  }
}

/**
 * External links sourced from API data must use authenticated HTTPS and must
 * not contain embedded credentials. Returns null when the link is unsafe.
 */
export function sanitizeExternalHttpsUrl(value: string | null | undefined): string | null {
  if (!value || CONTROL_CHARACTER_PATTERN.test(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
