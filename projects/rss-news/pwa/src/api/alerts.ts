// Alert set-up as the PWA sees it, and how the backend's JSON becomes it.

export interface PushSetup {
  // False when the server has no VAPID key, so it can't send Alerts.
  available: boolean;
  // The key a browser subscribes with; null when not available.
  publicKey: string | null;
  // How many phones have Alerts on.
  subscriptions: number;
  // No Alerts between these times ("HH:MM", the owner's time zone); start may be after end.
  quietHours: { start: string; end: string };
  // Most Alerts sent per day.
  dailyCap: number;
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
  quiet_hours: { start: string; end: string };
  daily_cap: number;
}

export function pushSetupFromJson(setup: PushSetupJson): PushSetup {
  return {
    available: setup.available,
    publicKey: setup.public_key,
    subscriptions: setup.subscriptions,
    quietHours: setup.quiet_hours,
    dailyCap: setup.daily_cap,
  };
}
