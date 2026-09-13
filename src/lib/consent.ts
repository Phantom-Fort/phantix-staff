// ── Analytics consent (cookies & analytics policy) ───────────────────────────
// First-party, cookieless analytics, still gated on explicit acceptance.

export type ConsentChoice = "accepted" | "declined";

const KEY = "phantix_cookie_consent";

export function getConsent(): ConsentChoice | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === "accepted" || value === "declined" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* storage disabled */
  }
}

export function clearConsent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export const COOKIE_POLICY_PATH = "/cookies";
