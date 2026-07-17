// chrome-extension/storage.js

// Configure local storage rules to avoid content scripts exposure
export async function initializeStorageSecurity() {
  if (chrome.storage.local.setAccessLevel) {
    try {
      await chrome.storage.local.setAccessLevel({
        accessLevel: "TRUSTED_CONTEXTS"
      });
    } catch (e) {
      console.warn("Could not set storage access level:", e);
    }
  }
}

export async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.session.get(['accessToken'], (res) => {
      resolve(res.accessToken || null);
    });
  });
}

export async function setAccessToken(token) {
  return new Promise((resolve) => {
    chrome.storage.session.set({ accessToken: token }, () => {
      resolve();
    });
  });
}

export async function getRefreshToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['refreshToken'], (res) => {
      resolve(res.refreshToken || null);
    });
  });
}

export async function setRefreshToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ refreshToken: token }, () => {
      resolve();
    });
  });
}

export async function getInstallationId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['installationId'], async (res) => {
      if (res.installationId) {
        resolve(res.installationId);
      } else {
        const newId = 'inst-' + Math.random().toString(36).substring(2) + '-' + Date.now();
        chrome.storage.local.set({ installationId: newId }, () => {
          resolve(newId);
        });
      }
    });
  });
}

export async function clearTokens() {
  return new Promise((resolve) => {
    chrome.storage.session.remove(['accessToken'], () => {
      chrome.storage.local.remove(['refreshToken'], () => {
        resolve();
      });
    });
  });
}
