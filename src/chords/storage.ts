const STORAGE_KEY = 'chords-editor:draft';

export interface SavedDraft {
  fileName: string;
  text: string;
  savedAt: string;
}

export function loadDraft(): SavedDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SavedDraft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: SavedDraft): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
