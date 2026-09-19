import * as Crypto from 'expo-crypto';
import { kvGet, kvSet } from './db';

export function newId() {
  return Crypto.randomUUID();
}

export function getDeviceId() {
  let id = kvGet('device_id');
  if (!id) {
    id = Crypto.randomUUID();
    kvSet('device_id', id);
  }
  return id;
}

// Two-character code that keeps order numbers unique across devices.
export function getDeviceCode() {
  let code = kvGet('device_code');
  if (!code) {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = Crypto.getRandomBytes(2);
    code = alphabet[bytes[0] % alphabet.length] + alphabet[bytes[1] % alphabet.length];
    kvSet('device_code', code);
  }
  return code;
}

export function nextOrderSequence() {
  const current = Number(kvGet('order_seq') ?? '0') + 1;
  kvSet('order_seq', String(current));
  return current;
}
