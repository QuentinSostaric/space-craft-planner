import {
  isObject,
  normalizeNumber,
  normalizeOrganizationSid,
  normalizeText,
} from './normalize.mjs';

const RSI_BASE_URL = 'https://robertsspaceindustries.com';

function normalizeComparableText(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeRsiVerificationProvider(value) {
  const provider = String(value ?? '').trim().toLowerCase();
  return provider === 'citizenid' || provider === 'rsi-profile' ? provider : null;
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutizeRsiUrl(value) {
  const input = String(value ?? '').trim();
  if (!input) {
    return null;
  }

  try {
    return new URL(input, RSI_BASE_URL).toString();
  } catch {
    return null;
  }
}

function firstMatch(value, pattern) {
  return String(value ?? '').match(pattern)?.[1] ?? null;
}

function parseRsiOrganizationBlock(block) {
  const organizationSid = stripHtml(
    firstMatch(block, /<span class="label[^"]*">Spectrum Identification \(SID\)<\/span>\s*<strong class="value[^"]*">([\s\S]*?)<\/strong>/),
  );
  if (!organizationSid) {
    return null;
  }

  const organizationName = stripHtml(
    firstMatch(block, /<a href="\/orgs\/[^"]+" class="value[^"]*"[^>]*>([\s\S]*?)<\/a>/),
  );
  const organizationRank = stripHtml(
    firstMatch(block, /<span class="label[^"]*">Organization rank<\/span>\s*<strong class="value[^"]*">([\s\S]*?)<\/strong>/),
  );
  const organizationLogo = firstMatch(block, /<a href="\/orgs\/[^"]+"><img src="([^"]+)"/);
  const activeStars = (block?.match(/<span class="active">/g) ?? []).length;
  const members = Number(String(firstMatch(block, /<span class="members">([\d,.\s]+)\s+members<\/span>/) ?? '').replace(/[^\d]/g, ''));

  return {
    ...normalizeOrganizationMetadata({
      sid: organizationSid,
      name: organizationName || organizationSid,
      logo: absolutizeRsiUrl(organizationLogo),
      image: absolutizeRsiUrl(organizationLogo),
      url: `${RSI_BASE_URL}/orgs/${encodeURIComponent(organizationSid)}`,
      members: Number.isFinite(members) && members > 0 ? members : null,
    }),
    rank: organizationRank || null,
    stars: activeStars || null,
  };
}

function parseRsiOrganizationBlocks(html) {
  const organizations = [];
  const pattern = /<div class="box-content org ([^"]+)">([\s\S]*?)(?=<div class="box-content org |<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/g;
  for (const match of String(html ?? '').matchAll(pattern)) {
    const organization = parseRsiOrganizationBlock(match[0]);
    if (!organization) {
      continue;
    }

    organizations.push({
      ...organization,
      source: String(match[1] ?? '').includes('main') ? 'profile-main' : 'manual',
    });
  }

  return organizations;
}

export function normalizeRsiHandle(value) {
  const handle = normalizeText(value);
  return handle || null;
}

export function normalizeRsiLink(value) {
  if (!isObject(value)) {
    return null;
  }

  const handle = normalizeRsiHandle(value.handle);
  if (!handle) {
    return null;
  }

  return {
    handle,
    displayName: value.displayName ? String(value.displayName) : null,
    profileUrl: value.profileUrl ? String(value.profileUrl) : null,
    verifiedAt: value.verifiedAt ? String(value.verifiedAt) : null,
    verificationProvider: normalizeRsiVerificationProvider(value.verificationProvider),
  };
}

function normalizeOrganizationMetadata(value, fallbackSid = null) {
  if (!isObject(value)) {
    return null;
  }

  const sid = normalizeOrganizationSid(value.sid ?? fallbackSid);
  if (!sid) {
    return null;
  }

  return {
    sid,
    name: normalizeText(value.name ?? value.display ?? sid) || sid,
    image: value.image ? String(value.image) : null,
    logo: value.logo ? String(value.logo) : null,
    banner: value.banner ? String(value.banner) : null,
    url: value.url ? String(value.url) : null,
    archetype: value.archetype ? String(value.archetype) : null,
    commitment: value.commitment ? String(value.commitment) : null,
    primaryFocus: value.primaryFocus ? String(value.primaryFocus) : null,
    secondaryFocus: value.secondaryFocus ? String(value.secondaryFocus) : null,
    lang: value.lang ? String(value.lang) : null,
    members: normalizeNumber(value.members),
    recruiting: typeof value.recruiting === 'boolean' ? value.recruiting : null,
    rank: value.rank ? String(value.rank) : null,
  };
}

export async function scrapeRsiProfileByHandle(handle, { fetchImpl = fetch } = {}) {
  const normalizedHandle = normalizeRsiHandle(handle);
  if (!normalizedHandle) {
    throw new Error('RSI handle is required.');
  }

  const response = await fetchImpl(
    `${RSI_BASE_URL}/en/citizens/${encodeURIComponent(normalizedHandle)}`,
    {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'ItemFab/2.0 RSI profile verifier',
      },
    },
  );
  if (!response.ok) {
    throw new Error(`RSI profile lookup failed with HTTP ${response.status}.`);
  }

  const html = await response.text();
  const profileBlock = firstMatch(html, /<div class="profile left-col">([\s\S]*?)<div class="main-org right-col/);
  const organizationBlock = firstMatch(
    html,
    /(<div class="main-org right-col[\s\S]*?<span class="deco-separator bottom"><\/span>\s*<\/div>)/,
  );
  const canonicalHandle =
    stripHtml(firstMatch(profileBlock, /<span class="label">Handle name<\/span>\s*<strong class="value">([\s\S]*?)<\/strong>/)) ||
    normalizedHandle;
  const displayName =
    stripHtml(firstMatch(profileBlock, /<p class="entry">\s*<strong class="value">([\s\S]*?)<\/strong>/)) ||
    canonicalHandle;
  const bio =
    stripHtml(firstMatch(html, /<div class="bio">([\s\S]*?)<\/div>/)) ||
    stripHtml(firstMatch(html, /<span class="label">Short Bio<\/span>[\s\S]*?<strong class="value">([\s\S]*?)<\/strong>/)) ||
    '';
  const imagePath = firstMatch(profileBlock, /<img src="([^"]+)"/);

  let scrapedOrganizations = [];
  try {
    const orgsResponse = await fetchImpl(
      `${RSI_BASE_URL}/en/citizens/${encodeURIComponent(normalizedHandle)}/organizations`,
      {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'ItemFab/2.0 RSI profile verifier',
        },
      },
    );
    if (orgsResponse.ok) {
      scrapedOrganizations = parseRsiOrganizationBlocks(await orgsResponse.text());
    }
  } catch {
    scrapedOrganizations = [];
  }

  const overviewOrganization = parseRsiOrganizationBlock(organizationBlock);
  const primaryOrganization =
    scrapedOrganizations.find((organization) => organization.source === 'profile-main') ??
    (overviewOrganization ? { ...overviewOrganization, source: 'profile-main' } : null);
  const affiliations = scrapedOrganizations.filter((organization) => organization.source !== 'profile-main');

  return {
    handle: canonicalHandle,
    displayName,
    bio,
    profileUrl: `${RSI_BASE_URL}/citizens/${encodeURIComponent(canonicalHandle)}`,
    image: absolutizeRsiUrl(imagePath),
    organization: primaryOrganization,
    affiliations,
    rank: primaryOrganization?.rank ?? null,
    stars: primaryOrganization?.stars ?? null,
  };
}

export function isOrganizationOwnerRank(rank) {
  const normalizedRank = normalizeComparableText(rank);
  return (
    normalizedRank.includes('owner') ||
    normalizedRank.includes('proprietaire') ||
    normalizedRank.includes('proprietor')
  );
}

export function isOrganizationAdminCandidate(member) {
  return Number(member?.stars ?? 0) >= 5 || isOrganizationOwnerRank(member?.rank);
}

export function bioContainsVerificationCode(bio, code) {
  const normalizedBio = String(bio ?? '').toUpperCase();
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  if (!normalizedBio || !normalizedCode) {
    return false;
  }

  return normalizedBio.includes(normalizedCode);
}

export async function verifyRsiHandleOwnership(
  apiKey,
  handle,
  verificationCode,
  options = {},
) {
  const normalizedCode = String(verificationCode ?? '').trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error('Verification code is required.');
  }

  const { fetchImpl = fetch } = options;
  const profile = await scrapeRsiProfileByHandle(handle, { fetchImpl });
  if (!bioContainsVerificationCode(profile.bio, normalizedCode)) {
    throw new Error('The verification code was not found in the RSI short bio.');
  }

  return normalizeRsiLink({
    handle: profile.handle,
    displayName: profile.displayName,
    profileUrl: profile.profileUrl,
    verifiedAt: new Date().toISOString(),
    verificationProvider: 'rsi-profile',
  });
}
