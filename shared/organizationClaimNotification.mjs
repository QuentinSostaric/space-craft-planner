import { readProcessEnv } from './normalize.mjs';

function normalizeWebhookUrl(env) {
  return String(
    env?.ORGANIZATION_CLAIM_REVIEW_WEBHOOK_URL ??
    readProcessEnv('ORGANIZATION_CLAIM_REVIEW_WEBHOOK_URL') ??
    '',
  ).trim();
}

export async function notifyOrganizationClaimRequest(env, claimRequest, { fetchImpl = fetch } = {}) {
  const webhookUrl = normalizeWebhookUrl(env);
  const reviewerEmail = String(claimRequest?.reviewerEmail ?? '').trim();
  if (!webhookUrl || !reviewerEmail) {
    return false;
  }

  const subject = `SC Craft organization claim review: ${claimRequest.organizationName} (${claimRequest.sid})`;
  const lines = [
    'A manual organization claim review was requested.',
    '',
    `Organization: ${claimRequest.organizationName} (${claimRequest.sid})`,
    `Discord: ${claimRequest.requestedByDiscordDisplayName ?? 'Unknown'} (@${claimRequest.requestedByDiscordUsername ?? 'unknown'})`,
    `RSI handle: ${claimRequest.requestedByRsiHandle ?? 'Unknown'}`,
    `Account id: ${claimRequest.accountId}`,
    `Submitted at: ${claimRequest.submittedAt}`,
  ];

  const response = await fetchImpl(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: reviewerEmail,
      subject,
      text: lines.join('\n'),
      claimRequest,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Organization claim webhook notification failed (${response.status}): ${text}`);
  }

  return true;
}
