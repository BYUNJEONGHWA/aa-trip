/**
 * Client-side-only "soft lock" for trip folders. Not real security — the Supabase
 * anon key can read/write every table regardless (see supabase_schema.sql RLS
 * policies), so this only deters someone browsing the UI without the password,
 * not a determined bypass via devtools/API. Good enough for keeping a handful of
 * people out of each other's trip folders.
 */

const UNLOCKED_SESSION_KEY = 'aa-trip-unlocked-folders';

export async function hashFolderPassword(plainText: string): Promise<string> {
  const bytes = new TextEncoder().encode(plainText);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readUnlockedSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.sessionStorage.getItem(UNLOCKED_SESSION_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function writeUnlockedSet(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(UNLOCKED_SESSION_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // sessionStorage unavailable (private browsing etc.) — unlock just won't persist
  }
}

export function isFolderUnlocked(tripId: string): boolean {
  return readUnlockedSet().has(tripId);
}

export function markFolderUnlocked(tripId: string) {
  const ids = readUnlockedSet();
  ids.add(tripId);
  writeUnlockedSet(ids);
}
