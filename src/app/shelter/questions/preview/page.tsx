'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { ShelterApplicationService } from '@/services/applications';
import {
  CATEGORY_LABELS,
  PET_TAG_LABELS,
  QUESTION_CATEGORIES,
  questionsForPreview,
} from '@/lib/applications/question-settings';
import type {
  ApplicationQuestion,
  PetTag,
  QuestionCategory,
  QuestionSpecies,
} from '@/types/applications';
import { useShelterMembership } from '../../ShelterGate';

const PET_TAGS = Object.keys(PET_TAG_LABELS) as PetTag[];

function choiceLabels(question: ApplicationQuestion): string[] {
  if (!Array.isArray(question.choices)) return [];
  return question.choices.map((choice) => {
    if (choice && typeof choice === 'object' && 'label' in choice) {
      return String((choice as { label: unknown }).label);
    }
    return String(choice);
  });
}

export default function ShelterQuestionsPreviewPage() {
  const { shelterId } = useShelterMembership();
  const [questions, setQuestions] = useState<ApplicationQuestion[]>([]);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());
  const [species, setSpecies] = useState<QuestionSpecies>('dog');
  const [tags, setTags] = useState<PetTag[]>([]);
  const [openCategory, setOpenCategory] = useState<QuestionCategory>('housing');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const service = new ShelterApplicationService(supabase);
      const [bank, ids] = await Promise.all([
        service.listApplicationQuestions(),
        service.listShownQuestionIds(shelterId),
      ]);
      setQuestions(bank);
      setShownIds(new Set(ids));
      setError(null);
    } catch {
      setError('We could not load the preview. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shelterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => questionsForPreview(questions, shownIds, species, tags),
    [questions, shownIds, species, tags]
  );

  const byCategory = useMemo(() => {
    const grouped = new Map<QuestionCategory, ApplicationQuestion[]>();
    for (const question of visible) {
      const list = grouped.get(question.category) ?? [];
      list.push(question);
      grouped.set(question.category, list);
    }
    return QUESTION_CATEGORIES.filter((category) => grouped.has(category)).map(
      (category) => ({
        category,
        questions: grouped.get(category) ?? [],
      })
    );
  }, [visible]);

  const openGroup =
    byCategory.find((group) => group.category === openCategory) ??
    byCategory[0];

  function toggleTag(tag: PetTag) {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
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
      <div
        role="status"
        className="alert bg-base-200 border-primary border-l-4"
      >
        <span>
          Preview: this is exactly what adopters will see. Nothing here can be
          filled in or sent.
        </span>
        <Link href="/shelter/questions" className="btn btn-primary min-h-11">
          Back to editing
        </Link>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Preview for:</span>
        <button
          type="button"
          className={`btn min-h-11 ${species === 'dog' ? 'btn-primary' : ''}`}
          aria-pressed={species === 'dog'}
          onClick={() => setSpecies('dog')}
        >
          Dog
        </button>
        <button
          type="button"
          className={`btn min-h-11 ${species === 'cat' ? 'btn-primary' : ''}`}
          aria-pressed={species === 'cat'}
          onClick={() => setSpecies('cat')}
        >
          Cat
        </button>
        <span className="ml-2 font-semibold">Pet tags:</span>
        {PET_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`btn btn-sm min-h-11 ${
              tags.includes(tag) ? 'btn-primary' : ''
            }`}
            aria-pressed={tags.includes(tag)}
            onClick={() => toggleTag(tag)}
          >
            {PET_TAG_LABELS[tag]}
          </button>
        ))}
        <span className="text-base-content/70 ml-auto">
          {visible.length} {visible.length === 1 ? 'question' : 'questions'} for
          a {species}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <nav aria-label="Preview steps" className="bg-base-200 rounded-box p-2">
          <ol>
            {byCategory.map((group, index) => (
              <li key={group.category}>
                <button
                  type="button"
                  className={`min-h-11 w-full cursor-pointer rounded-lg px-3 text-left transition-colors ${
                    openGroup?.category === group.category
                      ? 'bg-base-300'
                      : 'hover:bg-base-300'
                  }`}
                  onClick={() => setOpenCategory(group.category)}
                >
                  {index + 1}. {CATEGORY_LABELS[group.category]}
                  <span className="float-right">{group.questions.length}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {openGroup ? (
          <section className="bg-base-200 rounded-box p-4">
            <h2 className="text-lg font-semibold">
              {CATEGORY_LABELS[openGroup.category]}
              <span className="text-base-content/70 ml-2 font-normal">
                · {openGroup.questions.length} questions
              </span>
            </h2>
            <ul className="mt-4 space-y-6">
              {openGroup.questions.map((question) => {
                const choices = choiceLabels(question);
                return (
                  <li key={question.id}>
                    <p className="font-semibold">{question.wording}</p>
                    {question.species === 'dog' ? (
                      <p className="text-sm italic opacity-70">Dogs only</p>
                    ) : null}
                    {question.show_if?.question === 'hou.own_rent' ? (
                      <p className="text-sm italic opacity-70">
                        Asked only if they rent
                      </p>
                    ) : null}
                    {choices.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {choices.map((label) => (
                          <span
                            key={label}
                            className="badge badge-lg badge-ghost min-h-11 px-4"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-base-300 mt-2 min-h-11 rounded-lg px-3 py-2 opacity-70">
                        {question.answer_type === 'yes_no' ? 'Yes / No' : ' '}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
