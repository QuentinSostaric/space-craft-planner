function normalizeWebhookUrl(env) {
  return String(
    env?.ORGANIZATION_CLAIM_REVIEW_WEBHOOK_URL ??
    process.env.ORGANIZATION_CLAIM_REVIEW_WEBHOOK_URL ??
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

  await fetchImpl(webhookUrl, {
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

  return true;
}
