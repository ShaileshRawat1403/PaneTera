// chrome-extension/capture.js

// This file is injected into target tabs to extract safe page elements.
(() => {
  return {
    title: document.title || '',
    url: window.location.href || '',
    origin: window.location.origin || '',
    selectedText: window.getSelection ? window.getSelection().toString() : '',
    capturedAt: new Date().toISOString()
  };
})();
