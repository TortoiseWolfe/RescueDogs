'use client';

import React from 'react';
import type { ApplicationQuestion } from '@/types/applications';
import { fieldsForQuestion } from '@/lib/applications/application-flow';

type Choice = { value?: unknown; label?: unknown };

function choiceOptions(question: ApplicationQuestion): Array<{
  value: string;
  label: string;
}> {
  if (!Array.isArray(question.choices)) return [];
  return question.choices.map((choice) => {
    if (choice && typeof choice === 'object' && 'value' in choice) {
      const item = choice as Choice;
      return {
        value: String(item.value),
        label: String(item.label ?? item.value),
      };
    }
    return { value: String(choice), label: String(choice) };
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

export function BankQuestionField({
  question,
  value,
  onChange,
  visibleBank,
  error,
}: {
  question: ApplicationQuestion;
  value: unknown;
  onChange: (next: unknown) => void;
  visibleBank: readonly ApplicationQuestion[];
  error?: string;
}) {
  const id = `bank-${question.id.replace(/\./g, '-')}`;
  const required = !question.always_optional;
  const options = choiceOptions(question);

  return (
    <div className="form-control w-full">
      <label htmlFor={id} className="label">
        <span className="label-text">
          {question.wording}
          {required ? (
            <span className="text-error ml-1" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
      </label>

      {question.answer_type === 'long_text' ? (
        <textarea
          id={id}
          className={`textarea textarea-bordered w-full ${error ? 'textarea-error' : ''}`}
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          aria-required={required || undefined}
          aria-invalid={!!error}
        />
      ) : null}

      {question.answer_type === 'text' ||
      question.answer_type === 'email' ||
      question.answer_type === 'date' ? (
        <input
          id={id}
          type={
            question.answer_type === 'email'
              ? 'email'
              : question.answer_type === 'date'
                ? 'date'
                : 'text'
          }
          className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
          aria-required={required || undefined}
          aria-invalid={!!error}
        />
      ) : null}

      {question.answer_type === 'number' ? (
        <input
          id={id}
          type="number"
          className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
          value={typeof value === 'number' ? value : ''}
          onChange={(event) =>
            onChange(
              event.target.value === '' ? null : Number(event.target.value)
            )
          }
          aria-required={required || undefined}
          aria-invalid={!!error}
        />
      ) : null}

      {question.answer_type === 'yes_no' ? (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={id}>
          <span id={id} className="sr-only">
            {question.wording}
          </span>
          {[true, false].map((option) => (
            <button
              key={String(option)}
              type="button"
              className={`btn min-h-11 ${value === option ? 'btn-primary' : ''}`}
              aria-pressed={value === option}
              onClick={() => onChange(option)}
            >
              {option ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      ) : null}

      {question.answer_type === 'choice' ? (
        <select
          id={id}
          className={`select select-bordered w-full ${error ? 'select-error' : ''}`}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value || null)}
          aria-required={required || undefined}
          aria-invalid={!!error}
        >
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {question.answer_type === 'multi_choice' ? (
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const selected = Array.isArray(value) ? value.map(String) : [];
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="label cursor-pointer justify-start gap-3"
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((item) => item !== option.value)
                      : [...selected, option.value];
                    onChange(next);
                  }}
                />
                <span className="label-text">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}

      {question.answer_type === 'phone' ? (
        <input
          id={id}
          type="tel"
          className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
          value={String(asRecord(value).number ?? '')}
          onChange={(event) =>
            onChange(
              event.target.value.trim()
                ? { number: event.target.value.trim() }
                : null
            )
          }
          aria-required={required || undefined}
          aria-invalid={!!error}
        />
      ) : null}

      {question.answer_type === 'address' ||
      question.answer_type === 'contact' ||
      question.answer_type === 'group' ? (
        <ObjectFields
          id={id}
          fields={Array.isArray(question.fields) ? question.fields : undefined}
          value={asRecord(value)}
          onChange={onChange}
        />
      ) : null}

      {question.answer_type === 'repeat' ? (
        <RepeatFields
          id={id}
          fields={fieldsForQuestion(question, visibleBank)}
          value={asRecord(value)}
          onChange={onChange}
        />
      ) : null}

      {error ? (
        <p className="text-error mt-1 text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ObjectFields({
  id,
  fields,
  value,
  onChange,
}: {
  id: string;
  fields: unknown[] | undefined;
  value: Record<string, unknown>;
  onChange: (next: unknown) => void;
}) {
  const defs = Array.isArray(fields) ? fields : [];
  if (defs.length === 0) {
    return (
      <textarea
        id={id}
        className="textarea textarea-bordered w-full"
        rows={3}
        value={typeof value.note === 'string' ? value.note : ''}
        onChange={(event) =>
          onChange(
            event.target.value.trim() ? { note: event.target.value } : null
          )
        }
      />
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {defs.map((field) => {
        const def = field as { key?: string; label?: string; type?: string };
        if (!def.key) return null;
        const fieldId = `${id}-${def.key}`;
        const current = value[def.key];
        return (
          <div key={def.key} className="form-control w-full">
            <label htmlFor={fieldId} className="label py-1">
              <span className="label-text text-sm">{def.label ?? def.key}</span>
            </label>
            <input
              id={fieldId}
              type={def.type === 'phone' ? 'tel' : 'text'}
              className="input input-bordered w-full"
              value={
                typeof current === 'string' || typeof current === 'number'
                  ? String(current)
                  : ''
              }
              onChange={(event) => {
                const next = { ...value, [def.key!]: event.target.value };
                onChange(
                  Object.values(next).some((entry) =>
                    String(entry ?? '').trim()
                  )
                    ? next
                    : null
                );
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function RepeatFields({
  id,
  fields,
  value,
  onChange,
}: {
  id: string;
  fields: unknown[];
  value: Record<string, unknown>;
  onChange: (next: unknown) => void;
}) {
  const rows = Array.isArray(value.rows) ? [...value.rows] : [];
  const legacy = typeof value.legacy_note === 'string' ? value.legacy_note : '';

  return (
    <div className="space-y-3">
      {legacy ? (
        <p className="bg-base-200 rounded-lg p-3 text-sm">
          Saved note: {legacy}
        </p>
      ) : null}
      {rows.map((row, index) => (
        <div
          key={`${id}-row-${index}`}
          className="border-base-300 space-y-2 rounded-lg border p-3"
        >
          <ObjectFields
            id={`${id}-row-${index}`}
            fields={fields}
            value={asRecord(row)}
            onChange={(next) => {
              const nextRows = [...rows];
              nextRows[index] = next ?? {};
              onChange({ ...value, rows: nextRows });
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm min-h-11"
            onClick={() => {
              const nextRows = rows.filter((_, i) => i !== index);
              onChange(
                nextRows.length || legacy ? { ...value, rows: nextRows } : null
              );
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline min-h-11"
        onClick={() => onChange({ ...value, rows: [...rows, {}] })}
      >
        Add another
      </button>
    </div>
  );
}
