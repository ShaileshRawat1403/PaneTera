# Chrome Observation POC Architecture

To avoid exposing the MyAI Portal token within the context of untrusted external web pages, visibility observation is strictly divided into two phases:

1. **Trusted Browser Execution**: A trusted local automation tool (e.g. Puppeteer, Playwright, or a secure browser extension) runs inside the browser container to collect DOM outlines and capture viewport screenshots.
2. **Outside-Page Transfer**: The collected payload is sent to the local trusted agent runner, which then adds the Bearer Token and performs the POST request to the Portal endpoint.

---

## 1. Pseudocode for On-Page Data Collection

The following script extracts only visible roles and safe DOM layout items. It excludes cookies, input values, local storage details, and password forms.

```javascript
function captureSafePageTelemetry() {
  const visibleOutline = [];
  
  // Extract visible heading and button outlines
  const elements = document.querySelectorAll('h1, h2, h3, h4, button, a, [role="button"], [role="heading"]');
  
  elements.forEach(el => {
    // Only check visible elements
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    let role = "text";
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith('h')) role = "heading";
    else if (tag === 'button' || el.getAttribute('role') === 'button') role = "button";
    else if (tag === 'a') role = "link";
    
    // Ignore input text values entirely to avoid credential capture
    const text = (el.innerText || el.textContent || "").trim();
    if (!text) return;
    
    visibleOutline.push({
      role: role,
      text: text.substring(0, 300), // Cap length
      level: tag.startsWith('h') ? parseInt(tag[1]) : undefined
    });
  });

  return {
    source: "chrome-observation",
    url: window.location.href,
    title: document.title,
    observedAt: new Date().toISOString(),
    domOutline: visibleOutline.slice(0, 80) // Limit count
  };
}
```

---

## 2. Payload Transmission (Local Agent Context)

Once the data is retrieved by the local agent, it is transmitted with authentication headers:

```bash
curl -X POST http://127.0.0.1:4000/api/browser-observation \
  -H "Authorization: Bearer <SECURE_PORTAL_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "chrome-observation",
    "url": "https://example.com",
    "title": "Example Page",
    "observedAt": "2026-07-07T02:00:00Z",
    "domOutline": [
      { "role": "heading", "text": "Welcome to Example Page", "level": 1 }
    ]
  }'
```
