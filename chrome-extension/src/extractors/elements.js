import { getBaseContract, isVisible, createEvidenceItem } from './utils.js';

function accessibleName(element) {
  const ariaLabel = element.getAttribute('aria-label');
  const labelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabel) return ariaLabel.trim();
  if (labelledBy) {
    const label = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' ')
      .trim();
    if (label) return label;
  }
  return (element.innerText || element.textContent || element.getAttribute('title') || '').trim();
}

function inferRole(element) {
  const explicitRole = element.getAttribute('role');
  if (explicitRole) return explicitRole.toLowerCase();
  const tag = element.tagName.toLowerCase();
  if (tag === 'a' && element.hasAttribute('href')) return 'link';
  if (tag === 'button') return 'button';
  if (tag === 'input') {
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (['button', 'reset', 'submit'].includes(type)) return 'button';
  }
  return '';
}

function fingerprintElement(element, role, name) {
  const input = [
    role,
    name,
    element.tagName.toLowerCase(),
    (element.getAttribute('type') || '').toLowerCase(),
    element.getAttribute('name') || '',
    element.getAttribute('data-testid') || '',
    element.getAttribute('data-test') || '',
  ].join('|');
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function discoverInteractiveElements() {
  const contract = getBaseContract('browser.elements.discover');
  const supportedRoles = new Set(['button', 'link', 'checkbox', 'radio', 'tab']);
  const candidates = [];

  for (const element of document.querySelectorAll('a,button,input,[role]')) {
    if (candidates.length >= 250 || !isVisible(element) || element.disabled) continue;
    const role = inferRole(element);
    const name = accessibleName(element);
    if (!supportedRoles.has(role) || !name || name.length > 200) continue;
    const rect = element.getBoundingClientRect();
    const item = createEvidenceItem('interactive-element', 'interactive.semantic.v1');
    contract.evidence.items.push(item);
    contract.evidence.elementsMatched += 1;
    candidates.push({
      evidenceId: item.evidenceId,
      role,
      accessibleName: name,
      elementFingerprint: fingerprintElement(element, role, name),
      tagName: element.tagName.toLowerCase(),
      disabled: element.getAttribute('aria-disabled') === 'true',
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  }

  contract.data = { elements: candidates };
  contract.evidence.contentBytes = new Blob([JSON.stringify(contract.data)]).size;
  return contract;
}
