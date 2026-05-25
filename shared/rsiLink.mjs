import {
  isObject,
  normalizeOrganizationSid,
  normalizeText,
} from './normalize.mjs';

const STARCITIZEN_API_BASE_URL = 'https://api.starcitizen-api.com';
const ORGANIZATION_MEMBERS_PAGE_SIZE = 32;
const RSI_BASE_URL = 'https://robertsspaceindustries.com';

function normalizeComparableText(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

function normalizeOrganizationMember(value) {
  if (!isObject(value)) {
    return null;
  }

  const handle = normalizeRsiHandle(value.handle);
  if (!handle) {
    return null;
  }

  return {
    handle,
    display: normalizeText(value.display ?? handle) || handle,
    image: value.image ? String(value.image) : null,
    rank: value.rank ? String(value.rank) : null,
    stars: normalizeNumber(value.stars),
    roles: Array.isArray(value.roles)
      ? value.roles.map((role) => normalizeText(role)).filter(Boolean)
      : [],
  };
}

function normalizeOrganizationMemberPayload(member) {
  const normalizedMember = normalizeOrganizationMember(member);
  if (!normalizedMember) {
    return null;
  }

  return {
    ...normalizedMember,
    isAdminCandidate: isOrganizationAdminCandidate(normalizedMember),
  };
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toFriendlyRsiApiErrorMessage(message) {
  const normalizedMessage = normalizeText(message);
  const lowerCaseMessage = normalizedMessage.toLowerCase();
  if (
    lowerCaseMessage.includes('exceeded the limit') ||
    lowerCaseMessage.includes('quota') ||
    lowerCaseMessage.includes('too many requests')
  ) {
    return 'The daily live RSI verification limit has been reached. Try again tomorrow.';
  }
  if (
    lowerCaseMessage.includes("can't process") ||
    lowerCaseMessage.includes('cannot process') ||
    lowerCaseMessage.includes('malformed request') ||
    lowerCaseMessage.includes('request error')
  ) {
    return 'Star Citizen API could not process the RSI profile lookup. Check the handle and try again later.';
  }

  return normalizedMessage || 'Star Citizen API request failed.';
}

async function fetchRsiApiEndpoint(apiKey, path, { fetchImpl = fetch } = {}) {
  const normalizedApiKey = normalizeText(apiKey);
  if (!normalizedApiKey) {
    throw new Error('Star Citizen API key is not configured.');
  }

  const response = await fetchImpl(
    `${STARCITIZEN_API_BASE_URL}/${encodeURIComponent(normalizedApiKey)}${path}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    const message = payload?.message ?? payload?.error ?? `HTTP ${response.status}`;
    throw new Error(toFriendlyRsiApiErrorMessage(message));
  }
  if (payload?.success === 0) {
    const message = payload?.message ?? payload?.error ?? 'Star Citizen API request failed.';
    throw new Error(toFriendlyRsiApiErrorMessage(message));
  }

  return payload;
}

export async function fetchRsiApiKeyStatus(apiKey, { fetchImpl = fetch } = {}) {
  const payload = await fetchRsiApiEndpoint(apiKey, '/v1/me', { fetchImpl });

  return {
    remainingLiveRequests: Number(payload?.data?.value ?? 0),
  };
}

export async function fetchRsiProfileByHandle(
  apiKey,
  handle,
  { fetchImpl = fetch, mode = 'cache' } = {},
) {
  const normalizedHandle = normalizeRsiHandle(handle);
  if (!normalizedHandle) {
    throw new Error('RSI handle is required.');
  }

  const payload = await fetchRsiApiEndpoint(
    apiKey,
    `/v1/${encodeURIComponent(mode)}/user/${encodeURIComponent(normalizedHandle)}`,
    { fetchImpl },
  );

  const profile = payload?.data?.profile;
  const canonicalHandle = normalizeRsiHandle(profile?.handle ?? normalizedHandle);
  if (!canonicalHandle || !isObject(profile)) {
    throw new Error('Star Citizen API response did not include a valid profile.');
  }

  return {
    handle: canonicalHandle,
    displayName: profile.display ? String(profile.display) : canonicalHandle,
    bio: profile.bio ? String(profile.bio) : '',
    profileUrl: profile?.page?.url ? String(profile.page.url) : null,
    organization: normalizeOrganizationMetadata(payload?.data?.organization),
    affiliations: Array.isArray(payload?.data?.affiliation)
      ? payload.data.affiliation
          .map((organization) => normalizeOrganizationMetadata(organization))
          .filter((organization) => organization !== null)
      : [],
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

export async function fetchRsiOrganizationBySid(
  apiKey,
  sid,
  { fetchImpl = fetch, mode = 'cache' } = {},
) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new Error('Organization SID is required.');
  }

  const payload = await fetchRsiApiEndpoint(
    apiKey,
    `/v1/${encodeURIComponent(mode)}/organization/${encodeURIComponent(normalizedSid)}`,
    { fetchImpl },
  );

  const organization = normalizeOrganizationMetadata(payload?.data, normalizedSid);
  if (!organization) {
    throw new Error('Star Citizen API response did not include a valid organization.');
  }

  return organization;
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

export async function fetchRsiOrganizationMembersPage(
  apiKey,
  sid,
  page = 1,
  { fetchImpl = fetch, mode = 'live' } = {},
) {
  const normalizedSid = normalizeOrganizationSid(sid);
  if (!normalizedSid) {
    throw new Error('Organization SID is required.');
  }

  const pageNumber = Math.max(1, Math.trunc(Number(page) || 1));
  const payload = await fetchRsiApiEndpoint(
    apiKey,
    `/v1/${encodeURIComponent(mode)}/organization_members/${encodeURIComponent(normalizedSid)}?page=${pageNumber}`,
    { fetchImpl },
  );

  return Array.isArray(payload?.data)
    ? payload.data
        .map((member) => normalizeOrganizationMemberPayload(member))
        .filter((member) => member !== null)
    : [];
}

export async function fetchAllRsiOrganizationMembers(
  apiKey,
  sid,
  { fetchImpl = fetch } = {},
) {
  const members = [];
  const seenHandles = new Set();
  let page = 1;

  for (;;) {
    const pageMembers = await fetchRsiOrganizationMembersPage(apiKey, sid, page, {
      fetchImpl,
      mode: 'live',
    });

    for (const member of pageMembers) {
      const normalizedHandle = normalizeComparableText(member.handle);
      if (seenHandles.has(normalizedHandle)) {
        continue;
      }

      seenHandles.add(normalizedHandle);
      members.push(member);
    }

    if (pageMembers.length < ORGANIZATION_MEMBERS_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return members;
}

export async function findRsiOrganizationMemberByHandle(
  apiKey,
  sid,
  handle,
  { fetchImpl = fetch } = {},
) {
  const normalizedHandle = normalizeComparableText(handle);
  if (!normalizedHandle) {
    throw new Error('RSI handle is required.');
  }

  let page = 1;
  for (;;) {
    const pageMembers = await fetchRsiOrganizationMembersPage(apiKey, sid, page, {
      fetchImpl,
      mode: 'live',
    });
    const matchingMember = pageMembers.find(
      (member) => normalizeComparableText(member.handle) === normalizedHandle,
    );
    if (matchingMember) {
      return {
        member: matchingMember,
        page,
      };
    }

    if (pageMembers.length < ORGANIZATION_MEMBERS_PAGE_SIZE) {
      return null;
    }

    page += 1;
  }
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
  });
}
