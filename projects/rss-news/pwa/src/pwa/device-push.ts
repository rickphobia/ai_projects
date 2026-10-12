// This browser's side of Alerts: notification permission and its push subscription. Screens get
// a DevicePush passed in, and tests pass a fake.
import type { DeviceSubscription } from "../api/alerts";

// This browser's subscription, and the server key it was made with (base64url); null when the
// browser doesn't say.
export interface DeviceState {
  subscription: DeviceSubscription;
  serverKey: string | null;
}

export interface DevicePush {
  // False when this browser can't receive push messages at all.
  readonly supported: boolean;
  // This browser's subscription, or null when Alerts are off here.
  current(): Promise<DeviceState | null>;
  // Asks for permission to show notifications, then subscribes with the server's key.
  // Rejects with NotificationsBlocked when permission is refused.
  subscribe(applicationServerKey: string): Promise<DeviceSubscription>;
  // Gives back the endpoint that was dropped, or null when Alerts were already off here.
  unsubscribe(): Promise<string | null>;
}

export class NotificationsBlocked extends Error {
  override name = "NotificationsBlocked";
}

// For a browser without service workers, push or notifications.
export const noDevicePush: DevicePush = {
  supported: false,
  current: () => Promise.resolve(null),
  subscribe: () =>
    Promise.reject(new Error("This browser can't receive Alerts.")),
  unsubscribe: () => Promise.resolve(null),
};

export function browserDevicePush(
  container: ServiceWorkerContainer | undefined,
  notifications: typeof Notification | undefined,
): DevicePush {
  if (!container || !notifications || !("PushManager" in window)) {
    return noDevicePush;
  }
  // The subscription belongs to the service worker registered in register.ts.
  const pushManager = async (): Promise<PushManager> =>
    (await container.ready).pushManager;
  return {
    supported: true,
    async current() {
      const subscription = await (await pushManager()).getSubscription();
      if (!subscription) return null;
      const key = subscription.options.applicationServerKey;
      return {
        subscription: deviceSubscription(subscription),
        serverKey: key ? base64Url(key) : null,
      };
    },
    async subscribe(applicationServerKey) {
      const permission = await notifications.requestPermission();
      if (permission !== "granted") {
        throw new NotificationsBlocked(
          "Notifications are blocked for this app: allow them in the phone's settings.",
        );
      }
      const subscription = await (
        await pushManager()
      ).subscribe({ userVisibleOnly: true, applicationServerKey });
      return deviceSubscription(subscription);
    },
    async unsubscribe() {
      const subscription = await (await pushManager()).getSubscription();
      if (!subscription) return null;
      await subscription.unsubscribe();
      return subscription.endpoint;
    },
  };
}

// The same form the server gives its key in, so the two can be compared.
function base64Url(key: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(key));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function deviceSubscription(
  subscription: PushSubscription,
): DeviceSubscription {
  const { endpoint, keys } = subscription.toJSON();
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new Error("The browser gave a push subscription without its keys.");
  }
  return { endpoint, keys: { p256dh, auth } };
}
