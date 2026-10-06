"use client";

/** API keys live in this browser only (localStorage). Anyone holding a key can act as that account. */
export type Role = "buyer" | "seller";
const k = (role: Role) => `sy-key-${role}`;

export function getKey(role: Role): string | null {
  try {
    return window.localStorage.getItem(k(role));
  } catch {
    return null;
  }
}
export function setKey(role: Role, key: string): void {
  try {
    window.localStorage.setItem(k(role), key);
  } catch {
    /* storage blocked: the key is still shown once on screen */
  }
}
export function clearKey(role: Role): void {
  try {
    window.localStorage.removeItem(k(role));
  } catch {
    /* ignore */
  }
}
