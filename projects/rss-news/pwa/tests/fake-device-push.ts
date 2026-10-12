import type { DeviceSubscription } from "../src/api/alerts";
import {
  NotificationsBlocked,
  type DevicePush,
  type DeviceState,
} from "../src/pwa/device-push";

// A stand-in for the phone's push subscription: subscribe and unsubscribe change it like the
// browser would.
export class FakeDevicePush implements DevicePush {
  supported = true;
  subscription: DeviceSubscription | null = null;
  // The server key the subscription was made with.
  subscribedWith: string | null = null;
  // When true, the owner says no to notifications.
  permissionDenied = false;
  // The key each subscribe was called with.
  keysUsed: string[] = [];

  current(): Promise<DeviceState | null> {
    return Promise.resolve(
      this.subscription
        ? { subscription: this.subscription, serverKey: this.subscribedWith }
        : null,
    );
  }

  subscribe(applicationServerKey: string): Promise<DeviceSubscription> {
    this.keysUsed.push(applicationServerKey);
    if (this.permissionDenied) {
      return Promise.reject(
        new NotificationsBlocked(
          "Notifications are blocked for this app: allow them in the phone's settings.",
        ),
      );
    }
    this.subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/this-phone",
      keys: { p256dh: "BPhoneKey", auth: "phone-auth" },
    };
    this.subscribedWith = applicationServerKey;
    return Promise.resolve(this.subscription);
  }

  unsubscribe(): Promise<string | null> {
    const endpoint = this.subscription?.endpoint ?? null;
    this.subscription = null;
    this.subscribedWith = null;
    return Promise.resolve(endpoint);
  }
}
