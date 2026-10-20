import { afterEach, describe, expect, it } from 'vitest';
import {
  clearQuestionSettingsDraft,
  loadQuestionSettingsDraft,
  questionSettingsDraftKey,
  saveQuestionSettingsDraft,
} from './question-settings-draft';

const SHELTER = 'shelter-1';

describe('question-settings-draft (#476)', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('round-trips shown ids and remembered categories', () => {
    saveQuestionSettingsDraft(SHELTER, {
      shownIds: ['hou.restrictions'],
      remembered: { housing: ['hou.restrictions'] },
    });
    expect(loadQuestionSettingsDraft(SHELTER)).toEqual({
      shownIds: ['hou.restrictions'],
      remembered: { housing: ['hou.restrictions'] },
    });
  });

  it('returns null for invalid JSON or a bad shape', () => {
    sessionStorage.setItem(questionSettingsDraftKey(SHELTER), 'not json');
    expect(loadQuestionSettingsDraft(SHELTER)).toBeNull();

    sessionStorage.setItem(
      questionSettingsDraftKey(SHELTER),
      JSON.stringify({ shownIds: [1] })
    );
    expect(loadQuestionSettingsDraft(SHELTER)).toBeNull();
  });

  it('clear removes the draft', () => {
    saveQuestionSettingsDraft(SHELTER, {
      shownIds: ['hou.restrictions'],
      remembered: {},
    });
    clearQuestionSettingsDraft(SHELTER);
    expect(loadQuestionSettingsDraft(SHELTER)).toBeNull();
  });
});
