import { PostHogProvider } from '@posthog/react';
import posthog, { type PostHog } from 'posthog-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getApiUrl, isTauriRuntime } from '../services/apiBaseUrl';
import { LS_KEYS } from '../types';

type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

interface AnalyticsContextValue {
  enabled: boolean;
  trackEvent: (name: string, properties?: AnalyticsProperties) => void;
  trackPageView: (pageName: string, properties?: AnalyticsProperties) => void;
}

interface PostHogConfig {
  enabled: boolean;
  token: string;
  host: string;
}

declare const __APP_VERSION__: string;

const AnalyticsContext = createContext<AnalyticsContextValue>({
  enabled: false,
  trackEvent: () => {},
  trackPageView: () => {},
});

const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';
const MAX_QUEUED_EVENTS = 50;

let client: PostHog | null = null;
let initialized = false;
let initializationComplete = false;
let analyticsAllowed = false;
let contextProperties: AnalyticsProperties = {};
let queuedEvents: Array<{ name: string; properties?: AnalyticsProperties }> = [];

export type AnalyticsConsent = 'granted' | 'denied' | null;

const ANALYTICS_CONSENT_EVENT = 'sc-craft-analytics-consent-changed';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable in private browsing. The provider still
      // honours the choice for the remainder of the current session.
    }
  }
}

export function readAnalyticsConsent(): AnalyticsConsent {
  const value = readStorage(LS_KEYS.ANALYTICS_CONSENT);
  return value === 'granted' || value === 'denied' ? value : null;
}

export function setAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>): void {
  writeStorage(LS_KEYS.ANALYTICS_CONSENT, consent);
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

function getBuildConfig(): PostHogConfig | null {
  const token = (import.meta.env.VITE_POSTHOG_TOKEN ?? '').trim();
  const enabled = (import.meta.env.VITE_POSTHOG_ENABLED ?? '').trim();
  const host = (import.meta.env.VITE_POSTHOG_HOST ?? '').trim() || DEFAULT_POSTHOG_HOST;

  if (!token || enabled !== 'true') {
    return null;
  }

  return { enabled: true, token, host };
}

async function getRuntimeConfig(): Promise<PostHogConfig | null> {
  try {
    const response = await fetch('/api/public-config', { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      posthog?: { enabled?: unknown; token?: unknown; host?: unknown };
    };
    const token = typeof payload.posthog?.token === 'string' ? payload.posthog.token.trim() : '';
    const host = typeof payload.posthog?.host === 'string' && payload.posthog.host.trim()
      ? payload.posthog.host.trim()
      : DEFAULT_POSTHOG_HOST;

    if (payload.posthog?.enabled !== true || !token) {
      return null;
    }

    return { enabled: true, token, host };
  } catch {
    return null;
  }
}

async function loadConfig(): Promise<PostHogConfig | null> {
  return getBuildConfig() ?? await getRuntimeConfig();
}

function getAppVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';
}

// Route ingestion through our first-party /ingest proxy so tracker blockers
// don't drop the events. In Tauri the relative path has no host, so resolve it
// against the hosted API origin instead.
function getProxiedApiHost(): string {
  return isTauriRuntime() ? getApiUrl('/ingest') : `${window.location.origin}/ingest`;
}

// PostHog can't infer the app URL once api_host points at the proxy, so derive
// the UI host (eu.posthog.com) from the configured ingestion host (eu.i.posthog.com).
function getUiHost(ingestionHost: string): string {
  return ingestionHost.replace('.i.posthog.com', '.posthog.com');
}

function getPlatform(): string {
  if (!isTauriRuntime()) {
    return 'web';
  }

  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('linux') || ua.includes('x11')) return 'linux';
  if (ua.includes('macintosh') || ua.includes('mac os x')) return 'macos';
  return 'unknown';
}

function sanitizeProperties(properties: AnalyticsProperties | undefined): AnalyticsProperties {
  if (!properties) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => (
      value == null
      || typeof value === 'string'
      || typeof value === 'number'
      || typeof value === 'boolean'
    )),
  );
}

function getCommonProperties(): AnalyticsProperties {
  return {
    runtime: isTauriRuntime() ? 'tauri' : 'web',
    platform: getPlatform(),
    app_version: getAppVersion(),
    environment: import.meta.env.MODE,
    language: document.documentElement.lang || undefined,
    ...contextProperties,
  };
}

function capture(name: string, properties?: AnalyticsProperties): void {
  if (!analyticsAllowed || !client) {
    return;
  }

  try {
    client.capture(name, {
      ...getCommonProperties(),
      ...sanitizeProperties(properties),
    });
  } catch {
    // Analytics must never affect app behavior.
  }
}

async function initializeClient(): Promise<PostHog | null> {
  if (!analyticsAllowed) {
    return null;
  }
  if (initialized) {
    return client;
  }

  initialized = true;
  const config = await loadConfig();
  if (!analyticsAllowed) {
    initialized = false;
    initializationComplete = true;
    return null;
  }
  if (!config?.enabled) {
    initializationComplete = true;
    queuedEvents = [];
    return null;
  }

  posthog.init(config.token, {
    api_host: getProxiedApiHost(),
    ui_host: getUiHost(config.host),
    defaults: '2026-01-30',
    capture_pageview: 'history_change',
    persistence: 'localStorage',
    person_profiles: 'identified_only',
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    capture_pageleave: true,
    autocapture: false,
    // Disable extras that pull recognisably-named scripts/requests
    // (dead-clicks-autocapture.js, heatmaps, web-perf) which tracker
    // block lists flag even through a first-party proxy.
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_performance: false,
  });
  client = posthog;
  initializationComplete = true;
  queuedEvents.splice(0).forEach((event) => capture(event.name, event.properties));
  return client;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function errorMessageFromReason(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }
  if (typeof reason === 'string') {
    return reason;
  }
  return 'Unknown error';
}

export function setAnalyticsContext(properties: AnalyticsProperties): void {
  contextProperties = {
    ...contextProperties,
    ...sanitizeProperties(properties),
  };
}

// Bind the current PostHog identity to a stable user id and attach person
// properties used for feature-flag targeting. No-ops when analytics is
// disabled. Reloads flags so any identity-targeted flags resolve immediately.
export function identifyUser(distinctId: string, properties?: AnalyticsProperties): void {
  if (!analyticsAllowed || !client || !distinctId) {
    return;
  }

  try {
    client.identify(distinctId, sanitizeProperties(properties));
    client.reloadFeatureFlags();
  } catch {
    // Analytics must never affect app behavior.
  }
}

// Drop the identified person (logout) and fall back to an anonymous id.
export function resetIdentity(): void {
  if (!analyticsAllowed || !client) {
    return;
  }

  try {
    client.reset();
    client.reloadFeatureFlags();
  } catch {
    // Analytics must never affect app behavior.
  }
}

export function trackEvent(name: string, properties?: AnalyticsProperties): void {
  if (!analyticsAllowed) {
    return;
  }
  if (client) {
    capture(name, properties);
    return;
  }

  if (!initializationComplete && queuedEvents.length < MAX_QUEUED_EVENTS) {
    queuedEvents.push({ name, properties });
  }
}

export function trackPageView(pageName: string, properties?: AnalyticsProperties): void {
  trackEvent('page_viewed', {
    page: pageName,
    path: window.location.pathname,
    ...properties,
  });
}

export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext);
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<AnalyticsConsent>(readAnalyticsConsent);
  const [analyticsClient, setAnalyticsClient] = useState<PostHog | null>(null);
  const enabled = consent === 'granted' && Boolean(analyticsClient);
  const value = useMemo<AnalyticsContextValue>(() => ({
    enabled,
    trackEvent,
    trackPageView,
  }), [enabled]);

  useEffect(() => {
    const syncConsent = () => setConsent(readAnalyticsConsent());
    window.addEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
    window.addEventListener('storage', syncConsent);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
      window.removeEventListener('storage', syncConsent);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (consent !== 'granted') {
      analyticsAllowed = false;
      queuedEvents = [];
      initializationComplete = true;
      try {
        client?.opt_out_capturing();
        client?.reset();
      } catch {
        // Consent changes must never affect app behaviour.
      }
      setAnalyticsClient(null);
      return () => { cancelled = true; };
    }

    analyticsAllowed = true;
    initializationComplete = false;
    try {
      client?.opt_in_capturing();
    } catch {
      // A fresh client is initialized below when required.
    }
    void initializeClient().then((nextClient) => {
      if (!cancelled) {
        setAnalyticsClient(nextClient);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [consent]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    trackEvent('app_opened');

    const handleError = (event: ErrorEvent) => {
      trackEvent('frontend_error', {
        error_source: 'window_error',
        error_message: truncate(event.message || 'Unknown error', 240),
        error_type: event.error instanceof Error ? event.error.name : 'Error',
        error_line: event.lineno,
        error_column: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      trackEvent('frontend_error', {
        error_source: 'unhandled_rejection',
        error_message: truncate(errorMessageFromReason(event.reason), 240),
        error_type: event.reason instanceof Error ? event.reason.name : 'PromiseRejection',
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [enabled]);

  const content = (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );

  return analyticsClient ? (
    <PostHogProvider client={analyticsClient}>
      {content}
    </PostHogProvider>
  ) : content;
}
