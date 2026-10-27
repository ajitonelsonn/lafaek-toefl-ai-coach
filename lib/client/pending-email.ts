"use client";

// The email awaiting verification (not secret). Never store codes or passwords in browser storage.
const KEY = "lafaek-toefl:pending-email";

export function setPendingEmail(email: string) {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    /* ignore */
  }
}

export function getPendingEmail(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingEmail() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
