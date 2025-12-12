import { Injectable, isDevMode } from '@angular/core';
import { UnleashClient } from 'unleash-proxy-client';
import { initUnleashToolbar } from '@unleash/toolbar';
import '@unleash/toolbar/toolbar.css';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UnleashService {
  private client: any;

  constructor() {
    const unleashClient = new UnleashClient({
      url: environment.unleash.url,
      clientKey: environment.unleash.clientKey,
      appName: environment.unleash.appName,
      environment: environment.production ? 'production' : 'development',
      refreshInterval: 15,
    });

    // Only initialize toolbar in development mode
    if (isDevMode()) {
      this.client = initUnleashToolbar(unleashClient, {
        themePreset: 'dark',
        initiallyVisible: false,
      });
    } else {
      this.client = unleashClient;
    }
  }

  async start() {
    await this.client.start();
  }

  isEnabled(flagName: string): boolean {
    return this.client.isEnabled(flagName);
  }

  getVariant(flagName: string): any {
    return this.client.getVariant(flagName);
  }

  onUpdate(callback: () => void): void {
    this.client.on('update', callback);
  }
}
