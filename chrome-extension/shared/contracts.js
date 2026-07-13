// chrome-extension/shared/contracts.js

export const PROTOCOL_VERSION = "1.0";
export const CAPABILITY_VERSION = "1.0";

export const RiskLevels = {
  OBSERVE: "observe",
  INSPECT: "inspect",
  NAVIGATE: "navigate",
  INTERACT: "interact",
  DEBUG: "debug",
  LOCAL_ACTION: "local-action",
  SENSITIVE: "sensitive"
};

export const Capabilities = {
  BROWSER_PAGE_OBSERVE: "browser.page.observe",
  BROWSER_SELECTION_OBSERVE: "browser.selection.observe"
};
