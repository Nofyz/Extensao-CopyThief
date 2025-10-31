const SESSION_EVENT_NAME = 'copythief-extension-session';
const REQUEST_EVENT_NAME = 'copythief-extension-request-session';
let latestSession = null;
let latestUser = null;
let lastSentAccessToken = null;

function injectPageBridge() {
  if (document.documentElement.hasAttribute('data-copythief-extension-injected')) {
    return;
  }

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('copythief-site-injected.js');
  script.type = 'module';
  script.dataset.copythiefExtension = 'true';

  document.documentElement.setAttribute('data-copythief-extension-injected', 'true');
  (document.head || document.documentElement).appendChild(script);

  const removeScript = () => {
    if (script.parentNode) {
      script.parentNode.removeChild(script);
    }
  };

  script.addEventListener('load', removeScript, { once: true });
  script.addEventListener('error', removeScript, { once: true });
}

injectPageBridge();

function handleSessionPayload(payload) {
  if (!payload || !payload.session || !payload.session.access_token) {
    console.debug("[CopyThief][content] Received empty session payload from page");
    latestSession = null;
   latestUser = null;
   lastSentAccessToken = null;
   return;
 }

  console.debug("[CopyThief][content] Received session from page");
  latestSession = payload.session;
  latestUser = payload.user || null;
}

function notifyBackgroundIfNeeded() {
  if (!latestSession || !latestSession.access_token) {
    return;
  }

  if (latestSession.access_token === lastSentAccessToken) {
    return;
  }

  lastSentAccessToken = latestSession.access_token;
  console.debug("[CopyThief][content] Sending session to background");
  chrome.runtime
    .sendMessage({
      action: 'authDetectedOnPage',
      session: latestSession,
      user: latestUser,
    })
    .catch(() => {
      // Background might be unavailable; ignore
    });
}

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) {
    return;
  }

  const { source, payload } = event.data;
  if (source !== SESSION_EVENT_NAME) {
    return;
  }

  handleSessionPayload(payload);
  notifyBackgroundIfNeeded();
});

function requestSessionRefresh() {
  try {
    window.dispatchEvent(new Event(REQUEST_EVENT_NAME));
  } catch (error) {
    // Fallback for browsers without Event constructor support
    try {
      const customEvent = document.createEvent('Event');
      customEvent.initEvent(REQUEST_EVENT_NAME, true, true);
      window.dispatchEvent(customEvent);
    } catch (dispatchError) {
      // If dispatch fails, there's nothing else we can do here
    }
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== 'getAuthFromPage') {
    return false;
  }

  if (latestSession && latestSession.access_token) {
    sendResponse({ success: true, session: latestSession, user: latestUser });
    return false;
  }

  let responded = false;

  const handleOnce = (event) => {
    if (event.source !== window || !event.data) {
      return;
    }

    const { source, payload } = event.data;
    if (source !== SESSION_EVENT_NAME) {
      return;
    }

    handleSessionPayload(payload);

    if (!responded && latestSession && latestSession.access_token) {
      responded = true;
      window.removeEventListener('message', handleOnce, false);
      clearTimeout(timeoutId);
      notifyBackgroundIfNeeded();
      sendResponse({ success: true, session: latestSession, user: latestUser });
    }
  };

  window.addEventListener('message', handleOnce, false);
  requestSessionRefresh();

  const timeoutId = setTimeout(() => {
    if (responded) {
      return;
    }
    responded = true;
    window.removeEventListener('message', handleOnce, false);
    console.debug("[CopyThief][content] Timed out waiting for session from page");
    sendResponse({ success: false, error: 'No active session found' });
  }, 2000);

  return true;
});

requestSessionRefresh();
setTimeout(() => requestSessionRefresh(), 1000);
