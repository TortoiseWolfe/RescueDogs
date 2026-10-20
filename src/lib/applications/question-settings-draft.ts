import type { QuestionCategory } from '@/types/applications';

export type QuestionSettingsDraft = {
  shownIds: string[];
  remembered: Partial<Record<QuestionCategory, string[]>>;
};

export function questionSettingsDraftKey(shelterId: string): string {
  return `shelter:${shelterId}:question-settings-draft`;
}

function sessionStore(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isDraft(value: unknown): value is QuestionSettingsDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as QuestionSettingsDraft;
  if (!Array.isArray(draft.shownIds)) return false;
  if (!draft.shownIds.every((id) => typeof id === 'string')) return false;
  if (draft.remembered == null) return true;
  return (
    typeof draft.remembered === 'object' && !Array.isArray(draft.remembered)
  );
}

export function loadQuestionSettingsDraft(
  shelterId: string
): QuestionSettingsDraft | null {
  const store = sessionStore();
  if (!store) return null;
  try {
    const raw = store.getItem(questionSettingsDraftKey(shelterId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveQuestionSettingsDraft(
  shelterId: string,
  draft: QuestionSettingsDraft
): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.setItem(questionSettingsDraftKey(shelterId), JSON.stringify(draft));
  } catch {
    /* private mode / quota */
  }
}

export function clearQuestionSettingsDraft(shelterId: string): void {
  const store = sessionStore();
  if (!store) return;
  try {
    store.removeItem(questionSettingsDraftKey(shelterId));
  } catch {
    /* private mode / blocked site data */
  }
}
