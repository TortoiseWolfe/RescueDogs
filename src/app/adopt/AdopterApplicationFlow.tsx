'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CATEGORY_LABELS,
  type ApplicationQuestion,
  type AvailablePet,
  type PetTag,
  type QuestionCategory,
  type QuestionSpecies,
} from '@/types/applications';
import {
  REFERENCE_QUESTION_ID,
  formatAnswerForReview,
  hasAnsweredValue,
  needsReferenceShareConfirm,
  partitionApplicationQuestions,
  questionsForApplication,
  reuseProgressLabel,
} from '@/lib/applications/application-flow';
import { profileSnapshotFromAnswers } from '@/lib/applications/profile-from-answers';
import { QUESTION_CATEGORIES } from '@/lib/applications/question-settings';
import { BankQuestionField } from './BankQuestionField';

export type AdopterApplicationSubmitPayload = {
  petId: string;
  shelterId: string;
  profile: ReturnType<typeof profileSnapshotFromAnswers>;
  whyThisPet?: string;
  answers: Record<string, unknown>;
  snapshotOmitQuestionIds: string[];
};

type Step = 'pet' | 'questions' | 'review';

export function AdopterApplicationFlow({
  pets,
  preselectedPetId,
  savedAnswers,
  bank,
  shownByShelter,
  fallbackName,
  submitting,
  onPetIdChange,
  onSubmit,
}: {
  pets: AvailablePet[];
  preselectedPetId?: string;
  savedAnswers: ReadonlyMap<string, unknown>;
  bank: ApplicationQuestion[];
  shownByShelter: ReadonlyMap<string, string[]>;
  fallbackName: string;
  submitting?: boolean;
  onPetIdChange?: (petId: string) => void;
  onSubmit: (payload: AdopterApplicationSubmitPayload) => void | Promise<void>;
}) {
  const [petId, setPetId] = useState(preselectedPetId ?? '');
  const [step, setStep] = useState<Step>(
    preselectedPetId ? 'questions' : 'pet'
  );
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shareReferences, setShareReferences] = useState(true);

  useEffect(() => {
    if (preselectedPetId) {
      setPetId(preselectedPetId);
      setStep('questions');
      onPetIdChange?.(preselectedPetId);
    }
  }, [preselectedPetId, onPetIdChange]);

  const pet = pets.find((item) => item.id === petId) ?? null;
  const species = (pet?.species ?? 'dog') as QuestionSpecies;
  const shownIds = useMemo(
    () => new Set(shownByShelter.get(pet?.shelter_id ?? '') ?? []),
    [shownByShelter, pet?.shelter_id]
  );

  const shownQuestions = useMemo(() => {
    const tags = (pet?.application_tags ?? []) as PetTag[];
    return questionsForApplication(bank, shownIds, species, tags);
  }, [bank, shownIds, species, pet?.application_tags]);

  const mergedAnswers = useMemo(() => {
    const map = new Map(savedAnswers);
    for (const [key, value] of Object.entries(draft)) {
      map.set(key, value);
    }
    return map;
  }, [savedAnswers, draft]);

  const partition = useMemo(
    () => partitionApplicationQuestions(shownQuestions, mergedAnswers),
    [shownQuestions, mergedAnswers]
  );

  const banner = reuseProgressLabel(
    partition.answeredCount,
    partition.totalCount
  );

  // Pet comes from the picker; email is taken from the signed-in account.
  const askQuestions = partition.unanswered.filter(
    (question) =>
      question.id !== 'app.pet_interest' && question.id !== 'con.email'
  );

  const needsRefsConfirm = needsReferenceShareConfirm(
    shownQuestions,
    savedAnswers
  );

  function selectPet(nextId: string) {
    setPetId(nextId);
    onPetIdChange?.(nextId);
    setDraft({});
    setErrors({});
    setShareReferences(true);
    setStep('questions');
  }

  function setAnswer(questionId: string, value: unknown) {
    setDraft((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => {
      if (!current[questionId]) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  function validateQuestions(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const question of askQuestions) {
      if (question.always_optional) continue;
      const value = mergedAnswers.get(question.id);
      if (!hasAnsweredValue(value)) {
        nextErrors[question.id] = 'This question needs an answer';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function goToReview() {
    if (!pet) return;
    if (!validateQuestions()) return;
    setStep('review');
  }

  async function submit() {
    if (!pet) return;
    const why = mergedAnswers.get('app.why_this_pet');
    const whyThisPet = typeof why === 'string' ? why : undefined;

    const answersToSave: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(draft)) {
      if (key.startsWith('app.')) continue;
      if (hasAnsweredValue(value)) answersToSave[key] = value;
    }

    const omit =
      needsRefsConfirm && !shareReferences ? [REFERENCE_QUESTION_ID] : [];

    await onSubmit({
      petId: pet.id,
      shelterId: pet.shelter_id,
      profile: profileSnapshotFromAnswers(mergedAnswers, fallbackName),
      whyThisPet,
      answers: answersToSave,
      snapshotOmitQuestionIds: omit,
    });
  }

  const answeredByCategory = QUESTION_CATEGORIES.map((category) => ({
    category,
    questions: partition.answered.filter((item) => item.category === category),
  })).filter((group) => group.questions.length > 0);

  const askByCategory = QUESTION_CATEGORIES.map((category) => ({
    category,
    questions: askQuestions.filter((item) => item.category === category),
  })).filter((group) => group.questions.length > 0);

  return (
    <div className="space-y-6">
      {banner && step !== 'pet' ? (
        <div role="status" className="alert bg-base-200">
          <span>{banner}</span>
        </div>
      ) : null}

      {step === 'pet' || !pet ? (
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold">Choose a pet</legend>
          <select
            className="select select-bordered w-full"
            value={petId}
            onChange={(event) => {
              if (event.target.value) selectPet(event.target.value);
            }}
            aria-label="Pet to apply for"
          >
            <option value="">Select a pet…</option>
            {pets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.breed ? `${item.name} — ${item.breed}` : item.name}
              </option>
            ))}
          </select>
        </fieldset>
      ) : null}

      {pet && step === 'questions' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm opacity-70">
              Applying for <strong>{pet.name}</strong>
              {pet.shelters?.name ? ` with ${pet.shelters.name}` : ''}
            </p>
            <button
              type="button"
              className="btn btn-ghost btn-sm min-h-11"
              onClick={() => setStep('pet')}
            >
              Change pet
            </button>
          </div>

          {askByCategory.length === 0 ? (
            <p className="text-sm opacity-70">
              You already answered everything this rescue asks. Review and send
              next.
            </p>
          ) : (
            askByCategory.map((group) => (
              <section key={group.category} className="space-y-4">
                <h2 className="text-lg font-semibold">
                  {CATEGORY_LABELS[group.category as QuestionCategory]}
                </h2>
                {group.questions.map((question) => (
                  <BankQuestionField
                    key={question.id}
                    question={question}
                    value={mergedAnswers.get(question.id)}
                    onChange={(next) => setAnswer(question.id, next)}
                    visibleBank={bank}
                    error={errors[question.id]}
                  />
                ))}
              </section>
            ))
          )}

          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary min-h-11"
              onClick={goToReview}
            >
              Review application
            </button>
          </div>
        </div>
      ) : null}

      {pet && step === 'review' ? (
        <div className="space-y-6">
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-11"
            onClick={() => setStep('questions')}
          >
            Back to questions
          </button>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">New answers</h2>
            {askQuestions.length === 0 ? (
              <p className="text-sm opacity-70">No new answers this time.</p>
            ) : (
              <dl className="space-y-3">
                {askQuestions.map((question) => (
                  <div key={question.id}>
                    <dt className="font-medium">{question.wording}</dt>
                    <dd className="text-sm opacity-80">
                      {formatAnswerForReview(
                        question,
                        mergedAnswers.get(question.id)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          {answeredByCategory.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Already on file</h2>
              <p className="text-sm opacity-70">
                These answers will be shared with this rescue as part of your
                application.
              </p>
              {answeredByCategory.map((group) => (
                <div key={group.category} className="space-y-2">
                  <h3 className="font-medium">
                    {CATEGORY_LABELS[group.category as QuestionCategory]}
                  </h3>
                  <dl className="space-y-2">
                    {group.questions.map((question) => (
                      <div key={question.id}>
                        <dt className="text-sm font-medium">
                          {question.wording}
                        </dt>
                        <dd className="text-sm opacity-80">
                          {formatAnswerForReview(
                            question,
                            savedAnswers.get(question.id)
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </section>
          ) : null}

          {needsRefsConfirm ? (
            <label className="border-base-300 flex cursor-pointer items-start gap-3 rounded-lg border p-4">
              <input
                type="checkbox"
                className="checkbox mt-1"
                checked={shareReferences}
                onChange={(event) => setShareReferences(event.target.checked)}
              />
              <span>
                Share my saved personal references with{' '}
                {pet.shelters?.name?.trim() || 'this rescue'}?
                <span className="mt-1 block text-sm opacity-70">
                  Uncheck to keep those contacts off this application. Your
                  saved references stay in your account for next time.
                </span>
              </span>
            </label>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary min-h-11"
              disabled={submitting}
              onClick={() => void submit()}
            >
              {submitting ? 'Sending…' : 'Submit application'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
