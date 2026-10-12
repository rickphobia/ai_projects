// Alert set-up as the PWA sees it, and how the backend's JSON becomes it.

export interface PushSetup {
  // False when the server has no VAPID key, so it can't send Alerts.
  available: boolean;
  // The key a browser subscribes with; null when not available.
  publicKey: string | null;
  // How many phones have Alerts on.
  subscriptions: number;
}

// A browser's PushSubscription.toJSON(): where its push service reaches it, and the keys the
// server encrypts messages with.
export interface DeviceSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface TestAlertReport {
  delivered: number;
  // Phones whose subscription the push service called gone; the server forgot them.
  removed: number;
  // Phones that couldn't be reached this time; they're kept.
  failed: number;
}

export interface PushSetupJson {
  available: boolean;
  public_key: string | null;
  subscriptions: number;
}

export function pushSetupFromJson(setup: PushSetupJson): PushSetup {
  return {
    available: setup.available,
    publicKey: setup.public_key,
    subscriptions: setup.subscriptions,
  };
}
