import { WebPlugin } from '@capacitor/core';

import { RestLiveAction, RestLivePlugin, RestLiveState } from './rest-live';

/**
 * The browser build (development, and the QA runs): there is no lock
 * screen, so nothing shows and no button is ever tapped.
 */
export class RestLiveWeb extends WebPlugin implements RestLivePlugin {
  async isAvailable(): Promise<{ available: boolean }> {
    return { available: false };
  }

  async show(_state: RestLiveState): Promise<void> {
    // Nothing to show it on.
  }

  async end(): Promise<void> {
    // Nothing shown.
  }

  async takeActions(): Promise<{ actions: RestLiveAction[] }> {
    return { actions: [] };
  }
}
