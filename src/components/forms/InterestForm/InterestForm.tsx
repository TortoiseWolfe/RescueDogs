'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useWeb3Forms } from '@/hooks/useWeb3Forms';
import { type Web3FormsResponse } from '@/utils/web3forms';
import {
  interestSchema,
  interestToContactPayload,
  type InterestFormData,
  INTEREST_ROLES,
  INTEREST_ROLE_LABELS,
} from '@/schemas/interest.schema';

export interface InterestFormProps {
  className?: string;
  onSuccess?: (response: Web3FormsResponse) => void;
  onError?: (error: Error) => void;
}

export const InterestForm: React.FC<InterestFormProps> = ({
  className = '',
  onSuccess,
  onError,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setFocus,
  } = useForm<InterestFormData>({
    resolver: zodResolver(interestSchema),
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: {
      email: '',
      name: '',
      role: 'adopter',
      _gotcha: '',
    },
  });

  const {
    submitForm,
    isSubmitting,
    isSuccess,
    isError,
    error,
    successMessage,
    isOnline,
    wasQueuedOffline,
  } = useWeb3Forms({
    onSuccess,
    onError,
    successMessage: "You're on the list — thank you.",
  });

  const honeypotValue = watch('_gotcha');

  const onSubmit = async (data: InterestFormData) => {
    if (data._gotcha) {
      return;
    }
    await submitForm(interestToContactPayload(data));
  };

  useEffect(() => {
    if (isSuccess) {
      reset({ email: '', name: '', role: 'adopter', _gotcha: '' });
    }
  }, [isSuccess, reset]);

  useEffect(() => {
    const errorFields = Object.keys(errors) as (keyof InterestFormData)[];
    const firstErrorField = errorFields.find((field) => field !== '_gotcha');
    if (firstErrorField) {
      setFocus(firstErrorField);
    }
  }, [errors, setFocus]);

  return (
    <div className={`mx-auto w-full max-w-lg ${className}`}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
        aria-label="Early interest list signup"
      >
        {isSuccess && (
          <div role="alert" className="alert alert-success">
            <span>
              {wasQueuedOffline
                ? 'Saved offline — we will send it when you are back online.'
                : successMessage || "You're on the list — thank you."}
            </span>
          </div>
        )}

        {isError && error && (
          <div role="alert" className="alert alert-error">
            <span>{error}</span>
          </div>
        )}

        {!isOnline && (
          <div role="status" className="alert alert-warning">
            <span>
              You appear offline. You can still join — we will queue it.
            </span>
          </div>
        )}

        {/* Honeypot */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="interest-gotcha">Leave blank</label>
          <input
            {...register('_gotcha')}
            id="interest-gotcha"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypotValue ?? ''}
          />
        </div>

        <div>
          <label htmlFor="interest-email" className="label">
            <span className="label-text font-semibold">Email</span>
          </label>
          <input
            {...register('email')}
            id="interest-email"
            type="email"
            autoComplete="email"
            className={`input input-bordered min-h-11 w-full ${errors.email ? 'input-error' : ''}`}
            placeholder="you@example.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'interest-email-error' : undefined}
          />
          {errors.email && (
            <p
              id="interest-email-error"
              role="alert"
              className="text-error mt-1 text-sm"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="interest-name" className="label">
            <span className="label-text font-semibold">
              Name <span className="font-normal opacity-70">(optional)</span>
            </span>
          </label>
          <input
            {...register('name')}
            id="interest-name"
            type="text"
            autoComplete="name"
            className={`input input-bordered min-h-11 w-full ${errors.name ? 'input-error' : ''}`}
            placeholder="Alex"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'interest-name-error' : undefined}
          />
          {errors.name && (
            <p
              id="interest-name-error"
              role="alert"
              className="text-error mt-1 text-sm"
            >
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="interest-role" className="label">
            <span className="label-text font-semibold">I am mostly…</span>
          </label>
          <select
            {...register('role')}
            id="interest-role"
            className={`select select-bordered min-h-11 w-full ${errors.role ? 'select-error' : ''}`}
            aria-invalid={!!errors.role}
            aria-describedby={errors.role ? 'interest-role-error' : undefined}
          >
            {INTEREST_ROLES.map((role) => (
              <option key={role} value={role}>
                {INTEREST_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {errors.role && (
            <p
              id="interest-role-error"
              role="alert"
              className="text-error mt-1 text-sm"
            >
              {errors.role.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary min-h-11 w-full sm:w-auto"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Joining…' : 'Join the list'}
        </button>
      </form>
    </div>
  );
};

InterestForm.displayName = 'InterestForm';
