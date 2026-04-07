import {
  isObject,
  normalizeOrganizationSid,
  normalizeText,
} from './normalize.mjs';

const STARCITIZEN_API_BASE_URL = 'https://api.starcitizen-api.com';
const ORGANIZATION_MEMBERS_PAGE_SIZE = 32;

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
  const apiKeyStatus = await fetchRsiApiKeyStatus(apiKey, { fetchImpl });
  if (apiKeyStatus.remainingLiveRequests <= 0) {
    throw new Error('The daily live RSI verification limit has been reached. Try again tomorrow.');
  }

  const profile = await fetchRsiProfileByHandle(apiKey, handle, {
    ...options,
    fetchImpl,
    mode: 'live',
  });
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
