const SESSION_EVENT_NAME = 'copythief-extension-session';
const REQUEST_EVENT_NAME = 'copythief-extension-request-session';
const SUPABASE_KEY_HINTS = ['supabase', '__supabase', 'supabaseClient', 'copythiefSupabase', 'sb', 'client'];
let lastAccessToken = null;
let lastHadSession = false;
let resolving = false;

function parsePotentialSessionString(rawValue) {
  if (typeof rawValue !== 'string' || !rawValue.length) {
    return null;
  }

  const attempts = [rawValue];

  if (rawValue.startsWith('base64-')) {
    const base64Payload = rawValue.slice('base64-'.length);
    try {
      const decoded = atob(base64Payload);
      attempts.push(decoded);
    } catch (error) {
      // Ignore invalid base64
    }
  }

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Keep trying
    }
  }

  return null;
}

function postSession(payload) {
  window.postMessage({ source: SESSION_EVENT_NAME, payload }, '*');
}

function normalizeSessionPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const nestedKeys = ['data', 'session', 'currentSession', 'current', 'value'];
  for (const key of nestedKeys) {
    if (payload[key]) {
      const nested = normalizeSessionPayload(payload[key]);
      if (nested) {
        if (!nested.user) {
          nested.user =
            payload.user ||
            payload.user_metadata ||
            payload.currentUser ||
            (payload.data && payload.data.user) ||
            nested.user ||
            null;
        }
        return nested;
      }
    }
  }

  const accessToken = payload.access_token || payload.accessToken;
  if (!accessToken) {
    return null;
  }

  const refreshToken =
    payload.refresh_token ||
    payload.refreshToken ||
    null;

  let expiresAt =
    payload.expires_at ||
    payload.expiresAt ||
    null;

  const expiresIn =
    payload.expires_in ||
    payload.expiresIn ||
    null;

  if (!expiresAt && expiresIn) {
    const numericExpiresIn = Number(expiresIn);
    if (!Number.isNaN(numericExpiresIn) && Number.isFinite(numericExpiresIn)) {
      expiresAt = Math.floor(Date.now() / 1000) + numericExpiresIn;
    }
  }

  const numericExpiresAt = Number(expiresAt);
  const finalExpiresAt = Number.isFinite(numericExpiresAt) ? numericExpiresAt : Math.floor(Date.now() / 1000) + 3600;

  const user =
    payload.user ||
    payload.user_metadata ||
    payload.currentUser ||
    null;

  return {
    session: {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: finalExpiresAt,
    },
    user,
  };
}

function collectSupabaseClients() {
  const clients = new Set();

  try {
    for (const key of SUPABASE_KEY_HINTS) {
      const candidate = window[key];
      if (candidate && typeof candidate === 'object' && candidate.auth) {
        clients.add(candidate);
      }
    }
  } catch (error) {
    // Ignore lookup issues
  }

  try {
    Object.getOwnPropertyNames(window)
      .filter((name) => name && name.toLowerCase().includes('supabase'))
      .forEach((name) => {
        try {
          const candidate = window[name];
          if (candidate && typeof candidate === 'object' && candidate.auth) {
            clients.add(candidate);
          }
        } catch (error) {
          // Some getters may throw
        }
      });
  } catch (error) {
    // Accessing window keys can throw on some browsers; ignore
  }

  return Array.from(clients);
}

async function getSessionFromClient(client) {
  try {
    if (client && client.auth) {
      if (typeof client.auth.getSession === 'function') {
        const result = await client.auth.getSession();
        const session = (result && result.data && result.data.session) || result?.session || null;
        if (session) {
          const normalized = normalizeSessionPayload(session);
          if (normalized) {
            if (!normalized.user) {
              normalized.user = session.user || (result && result.data && result.data.user) || null;
            }
            return normalized;
          }
        }
      }

      const directSession = client.auth.session || client.auth.currentSession;
      if (directSession) {
        const normalized = normalizeSessionPayload(directSession);
        if (normalized) {
          if (!normalized.user) {
            normalized.user = directSession.user || client.auth.currentUser || null;
          }
          return normalized;
        }
      }
    }
  } catch (error) {
    // Ignore errors retrieving session from this client
  }

  return null;
}

function getSessionFromLocalStorage() {
  try {
    if (!window.localStorage) {
      return null;
    }
  } catch (error) {
    return null;
  }

  const keys = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key) {
        keys.push(key);
      }
    }
  } catch (error) {
    // Unable to iterate over localStorage
  }

  for (const key of keys) {
    if (!key || (!key.includes('supabase') && !key.includes('sb-'))) {
      continue;
    }

    let rawValue = null;
    try {
      rawValue = localStorage.getItem(key);
    } catch (error) {
      continue;
    }

    if (!rawValue) {
      continue;
    }

    const parsedValue = parsePotentialSessionString(rawValue);
    if (parsedValue) {
      const normalized = normalizeSessionPayload(parsedValue);
      if (normalized && normalized.session && normalized.session.access_token) {
        return normalized;
      }
    }

    if (typeof rawValue === 'string' && rawValue.includes('access_token')) {
      const tokenMatch = rawValue.match(/"access_token"\s*:\s*"([^"]+)"/);
      if (tokenMatch) {
        const refreshMatch = rawValue.match(/"refresh_token"\s*:\s*"([^"]+)"/);
        const expiresMatch = rawValue.match(/"expires_at"\s*:\s*(\d+)/);

        const session = {
          access_token: tokenMatch[1],
          refresh_token: refreshMatch ? refreshMatch[1] : null,
          expires_at: expiresMatch ? Number(expiresMatch[1]) : Math.floor(Date.now() / 1000) + 3600,
        };

        return {
          session,
          user: null,
        };
      }
    }
  }

  return null;
}

function getSessionFromCookies() {
  try {
    const cookieString = document.cookie;
    if (!cookieString || typeof cookieString !== 'string') {
      return null;
    }

    const segmentsByCookie = new Map();

    cookieString.split(';').forEach((rawEntry) => {
      const entry = rawEntry.trim();
      if (!entry) {
        return;
      }

      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        return;
      }

      const rawName = entry.slice(0, separatorIndex).trim();
      const rawValue = entry.slice(separatorIndex + 1);

      if (!rawName || !rawValue) {
        return;
      }

      if (!rawName.includes('sb-') || !rawName.includes('auth-token')) {
        return;
      }

      const [baseName, suffix] = rawName.split('.');
      const order = suffix ? Number(suffix) : 0;

      if (!segmentsByCookie.has(baseName)) {
        segmentsByCookie.set(baseName, []);
      }

      const decodedValue = decodeURIComponent(rawValue);
      const bucket = segmentsByCookie.get(baseName);
      bucket[Number.isFinite(order) ? order : bucket.length] = decodedValue;
    });

    for (const [, segments] of segmentsByCookie.entries()) {
      if (!segments || segments.length === 0) {
        continue;
      }

      const combined = segments.join('');
      const parsed = parsePotentialSessionString(combined);
      if (parsed) {
        const normalized = normalizeSessionPayload(parsed);
        if (normalized && normalized.session && normalized.session.access_token) {
          return normalized;
        }
      }
    }
  } catch (error) {
    // Falha ao ler cookies - ignora e segue
  }

  return null;
}

async function getSessionFromApi() {
  try {
    const meResponse = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!meResponse.ok) {
      return null;
    }

    let user = null;
    try {
      const meData = await meResponse.json();
      user = (meData && meData.data && meData.data.user) || meData?.user || null;
    } catch (parseError) {
      // Ignore JSON errors in /api/auth/me response
    }

    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!refreshResponse.ok) {
      return null;
    }

    const refreshData = await refreshResponse.json().catch(() => null);
    const normalized = normalizeSessionPayload(refreshData) || normalizeSessionPayload(refreshData && refreshData.data);

    if (normalized && normalized.session && normalized.session.access_token) {
      if (!normalized.user && user) {
        normalized.user = user;
      }
      return normalized;
    }
  } catch (error) {
    // Network or parsing error; ignore for now
  }

  return null;
}

async function resolveSession() {
  const clients = collectSupabaseClients();
  for (const client of clients) {
    const result = await getSessionFromClient(client);
    if (result && result.session && result.session.access_token) {
      return result;
    }
  }

  const localResult = getSessionFromLocalStorage();
  if (localResult && localResult.session && localResult.session.access_token) {
    return localResult;
  }

  const cookieResult = getSessionFromCookies();
  if (cookieResult && cookieResult.session && cookieResult.session.access_token) {
    return cookieResult;
  }

  return getSessionFromApi();
}

async function emitSession(force = false) {
  if (resolving) {
    return;
  }

  resolving = true;
  try {
    const result = await resolveSession();
    if (result && result.session && result.session.access_token) {
      const { session, user } = result;
      if (!force && session.access_token === lastAccessToken) {
        return;
      }

      lastAccessToken = session.access_token;
      lastHadSession = true;
      postSession({ session, user: user || null });
    } else if (lastHadSession || force) {
      lastAccessToken = null;
      lastHadSession = false;
      postSession(null);
    }
  } finally {
    resolving = false;
  }
}

function attachAuthListeners() {
  const clients = collectSupabaseClients();
  clients.forEach((client) => {
    if (!client || !client.auth || client.__copythiefAuthHooked) {
      return;
    }

    client.__copythiefAuthHooked = true;

    if (typeof client.auth.onAuthStateChange === 'function') {
      try {
        client.auth.onAuthStateChange((_event, session) => {
          if (session) {
            const normalized = normalizeSessionPayload(session);
            if (normalized && normalized.session && normalized.session.access_token) {
              if (!normalized.user) {
                normalized.user = session.user || null;
              }
              lastAccessToken = null; // Force re-emit with fresh data
              emitSession(true);
            }
          } else {
            lastAccessToken = null;
            emitSession(true);
          }
        });
      } catch (error) {
        // Ignore listener attachment errors
      }
    }
  });
}

window.addEventListener(REQUEST_EVENT_NAME, () => {
  emitSession(true);
});

emitSession(true);
setInterval(() => emitSession(false), 2000);
setInterval(() => attachAuthListeners(), 4000);
attachAuthListeners();

