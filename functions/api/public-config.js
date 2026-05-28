export async function onRequestGet({ env }) {
  const enabled = env.POSTHOG_ENABLED ?? env.VITE_POSTHOG_ENABLED ?? 'false';
  const token = env.POSTHOG_TOKEN ?? env.VITE_POSTHOG_TOKEN ?? '';
  const host = env.POSTHOG_HOST ?? env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

  return Response.json({
    posthog: {
      enabled: enabled === 'true' && Boolean(token),
      token,
      host,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}