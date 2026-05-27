import { PostHogProvider } from '@posthog/react';
import posthog, { type PostHog } from 'posthog-js';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { isTauriRuntime } from '../services/apiBaseUrl';

type AnalyticsValue = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<string, AnalyticsValue>;

interface AnalyticsContextValue {
  enabled: boolean;
  trackEvent: (name: string, properties?: AnalyticsProperties) => void;
  trackPageView: (pageName: string, properties?: AnalyticsProperties) => void;
}

declare const __APP_VERSION__: string;

const AnalyticsContext = createContext<AnalyticsContextValue>({
  enabled: false,
  trackEvent: () => {},
  trackPageView: () => {},
});

let client: PostHog | null = null;
let initialized = false;
let contextProperties: AnalyticsProperties = {};

function getEnvValue(name: string): string {
  const value = import.meta.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

function isAnalyticsEnabled(): boolean {
  return Boolean(getEnvValue('VITE_POSTHOG_TOKEN')) && getEnvValue('VITE_POSTHOG_ENABLED') === 'true';
}

function getAppVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';
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

function getClient(): PostHog | null {
  if (!isAnalyticsEnabled()) {
    return null;
  }

  if (initialized) {
    return client;
  }

  initialized = true;
  posthog.init(getEnvValue('VITE_POSTHOG_TOKEN'), {
    api_host: getEnvValue('VITE_POSTHOG_HOST') || 'https://eu.i.posthog.com',
    defaults: '2026-01-30',
    capture_pageview: 'history_change',
    person_profiles: 'identified_only',
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    capture_pageleave: true,
    autocapture: false,
  });
  client = posthog;
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

export function trackEvent(name: string, properties?: AnalyticsProperties): void {
  const analyticsClient = getClient();
  if (!analyticsClient) {
    return;
  }

  try {
    analyticsClient.capture(name, {
      ...getCommonProperties(),
      ...sanitizeProperties(properties),
    });
  } catch {
    // Analytics must never affect app behavior.
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
  const analyticsClient = useMemo(() => getClient(), []);
  const enabled = Boolean(analyticsClient);
  const value = useMemo<AnalyticsContextValue>(() => ({
    enabled,
    trackEvent,
    trackPageView,
  }), [enabled]);

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
