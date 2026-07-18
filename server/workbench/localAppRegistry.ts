import fs from 'fs';
import path from 'path';

export type LocalAppSandboxProfile = 'strict' | 'authenticated-local';

export interface LocalAppDefinition {
  appId: string;
  name: string;
  url: string;
  description?: string;
  icon?: string;
  enabled: boolean;
  sandboxProfile: LocalAppSandboxProfile;
}

export class LocalAppRegistry {
  private apps: Map<string, LocalAppDefinition> = new Map();

  constructor() {
    this.loadConfiguration();
  }

  public reloadConfiguration(): void {
    this.loadConfiguration();
  }

  private loadConfiguration(): void {
    this.apps.clear();
    
    const configPaths = [
      process.env.TESSERA_LOCAL_APPS_CONFIG,
      path.join(process.cwd(), 'config', 'local-apps.local.json')
    ];

    let loadedPath = '';
    let configData = null;

    for (const p of configPaths) {
      if (p && fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8');
          configData = JSON.parse(content);
          loadedPath = p;
          break;
        } catch (err) {
          console.warn(`[LocalAppRegistry] Failed to parse config at ${p}`, err);
        }
      }
    }

    if (!configData || !Array.isArray(configData.apps)) {
      console.log(`[LocalAppRegistry] No valid local app configuration found. Registry is empty.`);
      return;
    }

    for (const app of configData.apps) {
      if (this.validateAppDefinition(app)) {
        this.apps.set(app.appId, app);
      } else {
        console.warn(`[LocalAppRegistry] Rejected invalid app definition for ID: ${app.appId || 'unknown'}`);
      }
    }
    
    console.log(`[LocalAppRegistry] Loaded ${this.apps.size} apps from ${loadedPath}`);
  }

  private validateAppDefinition(app: any): app is LocalAppDefinition {
    if (!app || typeof app !== 'object') return false;
    
    // Check required fields
    if (typeof app.appId !== 'string' || !app.appId.match(/^[a-zA-Z0-9_-]+$/)) return false; // No path traversal or slashes
    if (typeof app.name !== 'string' || app.name.trim() === '') return false;
    if (typeof app.url !== 'string') return false;
    if (typeof app.enabled !== 'boolean') return false;
    if (app.sandboxProfile !== 'strict' && app.sandboxProfile !== 'authenticated-local') return false;
    
    // Check loopback URL
    if (!this.isValidLoopbackUrl(app.url)) return false;
    
    return true;
  }

  public isValidLoopbackUrl(urlStr: string): boolean {
    try {
      const u = new URL(urlStr);
      
      // Scheme must be http or https
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
      
      // Host must be exactly localhost or 127.0.0.1
      if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return false;
      
      // Explicit port must be present and numeric
      if (!u.port || !/^\d+$/.test(u.port)) {
         return false;
      }
      
      // No embedded credentials
      if (u.username || u.password) return false;
      
      return true;
    } catch (e) {
      return false; // Malformed URL
    }
  }

  public getEnabledApps(): LocalAppDefinition[] {
    return Array.from(this.apps.values()).filter(a => a.enabled);
  }

  public getApp(appId: string): LocalAppDefinition | undefined {
    return this.apps.get(appId);
  }
}

export const localAppRegistry = new LocalAppRegistry();
