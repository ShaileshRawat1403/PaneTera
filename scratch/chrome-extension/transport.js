// chrome-extension/transport.js
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken, getInstallationId } from './storage.js';

const GATEWAY_BASE_URL = 'http://127.0.0.1:4000';

export async function request(path, options = {}) {
  const url = `${GATEWAY_BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  // Inject Access Token if present (except for pairing routes)
  if (!path.includes('/pairing/')) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const fetchOptions = {
    ...options,
    headers
  };

  let response = await fetch(url, fetchOptions);

  // If 401 and we have a refresh token, try to refresh and retry once
  if (response.status === 401 && !path.includes('/pairing/') && !path.includes('/refresh')) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      const newToken = await getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, fetchOptions);
    }
  }

  return response;
}

async function attemptTokenRefresh() {
  const refreshToken = await getRefreshToken();
  const installationId = await getInstallationId();
  if (!refreshToken) return false;

  try {
    const url = `${GATEWAY_BASE_URL}/api/browser/token/refresh`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken,
        installationId
      })
    });

    if (res.ok) {
      const data = await res.json();
      await setAccessToken(data.accessToken);
      if (data.refreshToken) {
        await setRefreshToken(data.refreshToken);
      }
      return true;
    }
  } catch (e) {
    console.error('Failed to refresh local token:', e);
  }
  return false;
}
