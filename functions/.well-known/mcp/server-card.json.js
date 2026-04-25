import {
  buildServerCard,
  getSiteOrigin,
} from '../../_shared/agentMetadata.js';

export async function onRequestGet(context) {
  return new Response(`${JSON.stringify(buildServerCard(getSiteOrigin(context.request, context.env)), null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
