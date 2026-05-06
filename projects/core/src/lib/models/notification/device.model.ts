import { DevicePlatform } from './notification.enums';

/**
 * Web Push subscription as serialized by the browser's
 * pushManager.subscribe() call. Same shape PushSubscription.toJSON()
 * returns — we send it straight to the API.
 */
export interface WebPushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Body for POST /devices/register.
 *
 *   For platform = WEB:        send `subscription`
 *   For platform = IOS / ANDROID: send `tokenString` (FCM token)
 *
 * The BE rejects the request when the right field for the platform
 * is missing — class-validator catches it before the service is hit.
 */
export interface RegisterDevicePayload {
  platform: DevicePlatform;
  subscription?: WebPushSubscriptionPayload;
  tokenString?: string;
  deviceLabel?: string;
}

/**
 * The shape returned by GET /devices and POST /devices/register.
 * Matches the device_token row shape on the BE.
 */
export interface Device {
  id: string;
  userId: string;
  platform: DevicePlatform;
  token: string;
  endpointHash: string;
  deviceLabel: string | null;
  lastSeenAt: string;
  revokedAt: string | null;
  createdAt: string;
}
