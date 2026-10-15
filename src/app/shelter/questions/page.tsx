'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import {
  QuestionSettingsError,
  ShelterApplicationService,
} from '@/services/applications';
import {
  CATEGORY_LABELS,
  QUESTION_CATEGORIES,
  categoryCounts,
  categorySwitch,
  hideCategory,
  isQuestionShown,
  questionTags,
  showCategory,
  shownCount,
  toggleQuestion,
} from '@/lib/applications/question-settings';
import type {
  ApplicationQuestion,
  QuestionCategory,
} from '@/types/applications';
import { useShelterMembership } from '../ShelterGate';

const ERROR_MESSAGES: Record<string, string> = {
  not_a_manager: 'Only a manager of this rescue can change these questions.',
  invalid_shelter: 'We could not find this rescue. Reload and try again.',
  invalid_question: 'One of those questions is no longer in the bank.',
  invalid_questions: 'Too many questions at once. Hide a few and try again.',
  unknown: 'Could not save your changes. Please try again.',
};

export default function ShelterQuestionsPage() {
  const { shelterId, role } = useShelterMembership();
  const isManager = role === 'manager';

  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [remembered, setRemembered] = useState<
    Partial<Record<QuestionCategory, string[]>>
  >({});
  const [openCategory, setOpenCategory] = useState<QuestionCategory>('housing');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const service = new ShelterApplicationService(supabase);
      const [bank, ids] = await Promise.all([
        service.listApplicationQuestions(),
        service.listShownQuestionIds(shelterId),
      ]);
      const next = new Set(ids);
      setQuestions(bank);
      setShownIds(next);
      setSavedIds(new Set(ids));
      setError(null);
    } catch {
      setError('We could not load the question bank. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () => shownCount(questions, shownIds),
    [questions, shownIds]
  );
  const dirty = useMemo(() => {
    if (shownIds.size !== savedIds.size) return true;
    for (const id of shownIds) {
      if (!savedIds.has(id)) return true;
    }
    return false;
  }, [shownIds, savedIds]);

  const openQuestions = useMemo(
    () => questions.filter((question) => question.category === openCategory),
    [questions, openCategory]
  );

  async function onSave() {
    if (!isManager) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const service = new ShelterApplicationService(supabase);
      await service.setShownQuestionIds(shelterId, [...shownIds]);
      setSavedIds(new Set(shownIds));
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof QuestionSettingsError
          ? (ERROR_MESSAGES[err.code] ?? ERROR_MESSAGES.unknown)
          : ERROR_MESSAGES.unknown
      );
    } finally {
      setSaving(false);
    }
  }

  function onToggleCategory(category: QuestionCategory) {
    if (!isManager) return;
    const state = categorySwitch(questions, category, shownIds);
    if (state === 'locked') return;
    if (state === 'shown') {
      const result = hideCategory(questions, category, shownIds);
      setShownIds(result.shownIds);
      setRemembered((current) => ({
        ...current,
        [category]: result.remembered,
      }));
      return;
    }
    setShownIds(
      showCategory(questions, category, shownIds, remembered[category])
    );
  }

  function onToggleQuestion(question: ApplicationQuestion) {
    if (!isManager || question.is_locked) return;
    setShownIds(toggleQuestion(question, shownIds));
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Application questions</h2>
          <p className="text-base-content/70">
            {totals.locked} locked + {totals.extra} you chose = {totals.total}{' '}
            {totals.total === 1 ? 'question' : 'questions'} on your application
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/shelter/settings"
            className="btn btn-ghost btn-sm min-h-11"
          >
            Rescue settings
          </Link>
          <Link
            href="/shelter/questions/preview"
            className="btn btn-outline btn-sm min-h-11"
          >
            Preview
          </Link>
          <button
            type="button"
            className="btn btn-primary min-h-11"
            disabled={saving || !isManager || !dirty}
            onClick={() => void onSave()}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {!isManager ? (
        <div role="status" className="alert">
          <span>
            Only a manager can change which questions you ask. You can look, but
            ask a manager at your rescue to update them.
          </span>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      {saved ? (
        <div role="status" className="alert alert-success">
          <span>
            Saved. New applications use these questions; earlier ones stay as
            they were submitted.
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <nav
          aria-label="Question categories"
          className="bg-base-200 rounded-box max-h-[70vh] overflow-y-auto p-2"
        >
          {QUESTION_CATEGORIES.map((category) => {
            const counts = categoryCounts(questions, category, shownIds);
            if (counts.total === 0) return null;
            const state = categorySwitch(questions, category, shownIds);
            const selected = openCategory === category;
            return (
              <div
                key={category}
                className={`mb-1 flex items-center gap-1 rounded-lg p-1 ${
                  selected ? 'bg-base-300' : ''
                }`}
              >
                <button
                  type="button"
                  className="min-h-11 flex-1 px-2 text-left"
                  onClick={() => setOpenCategory(category)}
                  aria-current={selected ? 'true' : undefined}
                >
                  <span className="font-semibold">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="text-base-content/70 block text-sm">
                    {state === 'hidden'
                      ? `Hidden · 0 of ${counts.total} shown`
                      : `${counts.shown} of ${counts.total} shown`}
                    {counts.locked ? ` · ${counts.locked} locked` : ''}
                  </span>
                </button>
                {state === 'locked' ? null : (
                  <button
                    type="button"
                    className="btn btn-sm min-h-11 min-w-11"
                    disabled={!isManager}
                    aria-label={
                      state === 'shown'
                        ? `Hide ${CATEGORY_LABELS[category]}`
                        : `Show ${CATEGORY_LABELS[category]}`
                    }
                    onClick={() => onToggleCategory(category)}
                  >
                    {state === 'shown' ? '−' : '+'}
                  </button>
                )}
              </div>
            );
          })}
        </nav>

        <section className="bg-base-200 rounded-box p-4">
          <h3 className="text-lg font-semibold">
            {CATEGORY_LABELS[openCategory]}
          </h3>
          <p className="text-base-content/70 mb-4">
            Changes apply to applications sent after you save.
          </p>
          <ul className="divide-base-300 divide-y">
            {openQuestions.map((question) => {
              const shown = isQuestionShown(question, shownIds);
              const tags = questionTags(question);
              return (
                <li
                  key={question.id}
                  className="flex min-h-11 flex-wrap items-center gap-2 py-3"
                >
                  {question.is_locked ? (
                    <span className="badge badge-neutral min-h-11 px-3">
                      Locked
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm min-h-11 min-w-11"
                      disabled={!isManager}
                      aria-pressed={shown}
                      aria-label={
                        shown
                          ? `Hide ${question.wording}`
                          : `Show ${question.wording}`
                      }
                      onClick={() => onToggleQuestion(question)}
                    >
                      {shown ? '−' : '+'}
                    </button>
                  )}
                  <span
                    className={`flex-1 ${shown ? '' : 'text-base-content/60'}`}
                  >
                    {question.wording}
                    {question.parent_id ? (
                      <span className="text-base-content/70 block text-sm">
                        Extra field on {question.parent_id}
                      </span>
                    ) : null}
                  </span>
                  {tags
                    .filter((tag) => tag !== 'Locked')
                    .map((tag) => (
                      <span key={tag} className="badge badge-ghost">
                        {tag}
                      </span>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
