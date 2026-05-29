export async function onRequestGet({ env }) {
  const enabled = env.POSTHOG_ENABLED ?? env.VITE_POSTHOG_ENABLED ?? 'false';
  const token = env.POSTHOG_TOKEN ?? env.VITE_POSTHOG_TOKEN ?? '';
  const host = env.POSTHOG_HOST ?? env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
  const isEnabled = enabled === 'true' && Boolean(token);

  return Response.json({
    posthog: {
      enabled: isEnabled,
      token: isEnabled ? token : '',
      host,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
