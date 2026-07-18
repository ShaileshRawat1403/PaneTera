import http from 'http';
import https from 'https';

export type ProbeStatus = 
  | 'checking'
  | 'reachable'
  | 'redirect'
  | 'unavailable'
  | 'framing-likely-blocked'
  | 'invalid-configuration';

export interface ProbeResult {
  status: ProbeStatus;
  url: string;
  details?: string;
  redirectUrl?: string;
}

export class LocalAppProbe {
  private readonly TIMEOUT_MS = 3000;

  public async probe(appUrl: string, maxRedirects = 3): Promise<ProbeResult> {
    if (maxRedirects < 0) {
      return { status: 'invalid-configuration', url: appUrl, details: 'Too many redirects' };
    }

    return new Promise((resolve) => {
      let urlObj: URL;
      try {
        urlObj = new URL(appUrl);
      } catch (e) {
        return resolve({ status: 'invalid-configuration', url: appUrl, details: 'Malformed URL' });
      }

      // Reject URLs containing user-info credentials immediately
      if (urlObj.username || urlObj.password) {
        return resolve({ status: 'invalid-configuration', url: appUrl, details: 'Redirect or request contains credentials' });
      }

      const client = urlObj.protocol === 'https:' ? https : http;
      
      const req = client.get(urlObj, {
        timeout: this.TIMEOUT_MS,
        // Use an explicit minimal header allowlist. NEVER forward incoming headers.
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Tessera-Workbench-Probe/1.0'
        }
      }, (res) => {
        // Discard body completely
        res.resume();

        const statusCode = res.statusCode || 0;

        // Handle Redirects
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          try {
            const redirectUrlObj = new URL(res.headers.location, appUrl);
            
            // Reject redirect URLs containing credentials
            if (redirectUrlObj.username || redirectUrlObj.password) {
               return resolve({ status: 'invalid-configuration', url: appUrl, details: 'Redirect location contains credentials' });
            }

            return resolve({ 
              status: 'redirect', 
              url: appUrl, 
              redirectUrl: redirectUrlObj.toString() 
            });
          } catch (e) {
             return resolve({ status: 'invalid-configuration', url: appUrl, details: 'Invalid redirect location' });
          }
        }

        // We consider 2xx, 401, 403 as "reachable" because the server is responding HTTP properly.
        // Even 404 or 500 means the server exists.
        
        // Check Framing Headers
        const csp = (res.headers['content-security-policy'] as string) || '';
        const xFrame = (res.headers['x-frame-options'] as string) || '';

        const hasFrameAncestorsNone = csp.toLowerCase().includes("frame-ancestors 'none'");
        const hasXFrameDeny = xFrame.toUpperCase().includes("DENY") || xFrame.toUpperCase().includes("SAMEORIGIN"); 

        if (hasFrameAncestorsNone || hasXFrameDeny) {
          return resolve({ status: 'framing-likely-blocked', url: appUrl });
        }

        return resolve({ status: 'reachable', url: appUrl });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ status: 'unavailable', url: appUrl, details: 'Connection timed out' });
      });

      req.on('error', (err: any) => {
        resolve({ status: 'unavailable', url: appUrl, details: err.message });
      });
    });
  }
}

export const localAppProbe = new LocalAppProbe();
