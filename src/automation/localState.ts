export type PersistedInboxState = {
  drafts: Record<string, string>;
  sentIds: string[];
  gmailDraftIds: Record<string, string>;
};

const inboxStateStorageKey = "auto-inbox:inbox-state";

export function loadPersistedInboxState(): PersistedInboxState {
  const storage = getLocalStorage();
  if (!storage) return emptyState();

  try {
    const rawValue = storage.getItem(inboxStateStorageKey);
    if (!rawValue) return emptyState();

    const parsed = JSON.parse(rawValue) as Partial<PersistedInboxState>;
    return {
      drafts: isStringRecord(parsed.drafts) ? parsed.drafts : {},
      sentIds: Array.isArray(parsed.sentIds) ? parsed.sentIds.filter(isString) : [],
      gmailDraftIds: isStringRecord(parsed.gmailDraftIds) ? parsed.gmailDraftIds : {},
    };
  } catch {
    return emptyState();
  }
}

export function persistInboxState(state: PersistedInboxState) {
  const storage = getLocalStorage();
  if (!storage) return;

  storage.setItem(inboxStateStorageKey, JSON.stringify(state));
}

function emptyState(): PersistedInboxState {
  return {
    drafts: {},
    sentIds: [],
    gmailDraftIds: {},
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    Object.values(value as Record<string, unknown>).every(isString)
  );
}

function getLocalStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}
