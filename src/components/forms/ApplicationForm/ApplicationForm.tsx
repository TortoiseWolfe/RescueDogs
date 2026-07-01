'use client';

import { useEffect } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import {
  applicationSchema,
  HOUSING_TYPE_OPTIONS,
  type ApplicationFormData,
} from '@/schemas/application.schema';
import { isRenting } from '@/types/applications';
import type { HousingType, Pet } from '@/types/applications';
import { FormError } from '../FormError';

export interface ApplicationFormProps {
  /** Pets available to apply for — parent passes the available list. */
  pets: Pet[];
  /** Prefill values, e.g. from a saved adopter profile. */
  defaultValues?: Partial<ApplicationFormData>;
  /** Preselects the pet in section 1 (wins over defaultValues.pet_id). */
  preselectedPetId?: string;
  /** Receives the zod-parsed form data on valid submit. */
  onSubmit: (data: ApplicationFormData) => void | Promise<void>;
  /** Disables the submit button while the parent persists the application. */
  submitting?: boolean;
  /** Additional CSS classes for the form element. */
  className?: string;
}

/**
 * RHF operates on the schema's *input* type (strings from the DOM,
 * pre-coercion numbers); zodResolver transforms to ApplicationFormData
 * (the output type) before handleSubmit hands it to the parent.
 */
type ApplicationFormInput = z.input<typeof applicationSchema>;

function petOptionLabel(pet: Pet): string {
  return pet.breed ? `${pet.name} — ${pet.breed}` : pet.name;
}

interface TextFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  type?: 'text' | 'tel' | 'number';
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  min?: number;
  max?: number;
  inputMode?: 'numeric' | 'tel' | 'text';
}

/** Labeled input + linked error message (module scope: stable identity). */
function TextField({
  id,
  label,
  registration,
  error,
  type = 'text',
  required = false,
  placeholder,
  autoComplete,
  min,
  max,
  inputMode,
}: TextFieldProps) {
  return (
    <div className="form-control w-full">
      <label htmlFor={id} className="label">
        <span className="label-text">
          {label}
          {required && (
            <span className="text-error ml-1" aria-hidden="true">
              *
            </span>
          )}
        </span>
      </label>
      <input
        {...registration}
        id={id}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        min={min}
        max={max}
        inputMode={inputMode}
        className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
        aria-required={required || undefined}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FormError error={error} id={`${id}-error`} />
    </div>
  );
}

interface TextAreaFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  placeholder?: string;
  rows?: number;
}

function TextAreaField({
  id,
  label,
  registration,
  error,
  placeholder,
  rows = 3,
}: TextAreaFieldProps) {
  return (
    <div className="form-control w-full">
      <label htmlFor={id} className="label">
        <span className="label-text">{label}</span>
      </label>
      <textarea
        {...registration}
        id={id}
        rows={rows}
        placeholder={placeholder}
        className={`textarea textarea-bordered w-full ${error ? 'textarea-error' : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <FormError error={error} id={`${id}-error`} />
    </div>
  );
}

interface CheckboxFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
}

function CheckboxField({ id, label, registration, error }: CheckboxFieldProps) {
  return (
    <div className="form-control">
      <label htmlFor={id} className="label cursor-pointer justify-start gap-3">
        <input
          {...registration}
          id={id}
          type="checkbox"
          className={`checkbox ${error ? 'checkbox-error' : ''}`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span className="label-text">{label}</span>
      </label>
      <FormError error={error} id={`${id}-error`} />
    </div>
  );
}

/**
 * ApplicationForm — the universal adoption application.
 *
 * Presentational: props in, callbacks out. Five fieldset sections validated
 * by applicationSchema (React Hook Form + zodResolver). The landlord block
 * only renders while renting; yard fencing only while has_yard is checked.
 *
 * @category forms
 */
export default function ApplicationForm({
  pets,
  defaultValues,
  preselectedPetId,
  onSubmit,
  submitting = false,
  className = '',
}: ApplicationFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ApplicationFormInput, unknown, ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
    defaultValues: {
      pet_id: '',
      full_name: '',
      phone: '',
      address_line: '',
      city: '',
      state: '',
      zip: '',
      // '' selects the disabled placeholder option; without an explicit
      // default the browser auto-selects the first *enabled* option
      // (own_house), silently skipping the required choice. Zod rejects ''
      // with the friendly enum message.
      housing_type: '' as unknown as ApplicationFormInput['housing_type'],
      landlord_approval: false,
      landlord_contact: '',
      has_yard: false,
      yard_fenced: false,
      household_adults: 1,
      household_children: 0,
      other_pets: '',
      vet_name: '',
      vet_phone: '',
      experience: '',
      why_this_pet: '',
      ...defaultValues,
      ...(preselectedPetId ? { pet_id: preselectedPetId } : {}),
    },
  });

  // Apply a preselected pet that arrives AFTER mount. Under static export the
  // /adopt page reads ?pet= via useSearchParams in a useEffect, so
  // preselectedPetId is undefined on first paint. React Hook Form only reads
  // defaultValues once at mount, so without this the /adopt?pet=<id> deep-link
  // never selects the pet. Guarded on a real value so it can't stomp a user's
  // manual choice back to the placeholder.
  useEffect(() => {
    if (preselectedPetId) {
      setValue('pet_id', preselectedPetId);
    }
  }, [preselectedPetId, setValue]);

  const housingType = watch('housing_type') as HousingType | undefined;
  const renting = !!housingType && isRenting(housingType);
  const hasYard = !!watch('has_yard');

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data))}
      className={`space-y-6 ${className}`.trim()}
      aria-label="Adoption application form"
      noValidate
    >
      {/* 1 — This Pet */}
      <fieldset className="fieldset border-base-300 rounded-box w-full border p-4">
        <legend className="fieldset-legend px-2 text-base font-semibold">
          This Pet
        </legend>
        <div className="form-control w-full">
          <label htmlFor="pet_id" className="label">
            <span className="label-text">
              Pet
              <span className="text-error ml-1" aria-hidden="true">
                *
              </span>
            </span>
          </label>
          <select
            {...register('pet_id')}
            id="pet_id"
            className={`select select-bordered w-full ${errors.pet_id ? 'select-error' : ''}`}
            aria-required="true"
            aria-invalid={!!errors.pet_id}
            aria-describedby={errors.pet_id ? 'pet_id-error' : undefined}
          >
            <option value="" disabled>
              Select a pet
            </option>
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {petOptionLabel(pet)}
              </option>
            ))}
          </select>
          <FormError error={errors.pet_id?.message} id="pet_id-error" />
        </div>
      </fieldset>

      {/* 2 — About You */}
      <fieldset className="fieldset border-base-300 rounded-box w-full border p-4">
        <legend className="fieldset-legend px-2 text-base font-semibold">
          About You
        </legend>
        <div className="space-y-4">
          <TextField
            id="full_name"
            label="Full name"
            required
            registration={register('full_name')}
            error={errors.full_name?.message}
            placeholder="Jane Doe"
            autoComplete="name"
          />
          <TextField
            id="phone"
            label="Phone"
            type="tel"
            inputMode="tel"
            registration={register('phone')}
            error={errors.phone?.message}
            placeholder="555-555-0123"
            autoComplete="tel"
          />
          <TextField
            id="address_line"
            label="Street address"
            registration={register('address_line')}
            error={errors.address_line?.message}
            autoComplete="street-address"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextField
              id="city"
              label="City"
              registration={register('city')}
              error={errors.city?.message}
              autoComplete="address-level2"
            />
            <TextField
              id="state"
              label="State"
              registration={register('state')}
              error={errors.state?.message}
              autoComplete="address-level1"
            />
            <TextField
              id="zip"
              label="ZIP"
              registration={register('zip')}
              error={errors.zip?.message}
              autoComplete="postal-code"
            />
          </div>
        </div>
      </fieldset>

      {/* 3 — Your Home */}
      <fieldset className="fieldset border-base-300 rounded-box w-full border p-4">
        <legend className="fieldset-legend px-2 text-base font-semibold">
          Your Home
        </legend>
        <div className="space-y-4">
          <div className="form-control w-full">
            <label htmlFor="housing_type" className="label">
              <span className="label-text">
                Housing situation
                <span className="text-error ml-1" aria-hidden="true">
                  *
                </span>
              </span>
            </label>
            <select
              {...register('housing_type')}
              id="housing_type"
              className={`select select-bordered w-full ${errors.housing_type ? 'select-error' : ''}`}
              aria-required="true"
              aria-invalid={!!errors.housing_type}
              aria-describedby={
                errors.housing_type ? 'housing_type-error' : undefined
              }
            >
              <option value="" disabled>
                Select your housing situation
              </option>
              {HOUSING_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FormError
              error={errors.housing_type?.message}
              id="housing_type-error"
            />
          </div>

          {renting && (
            <div className="bg-base-200 rounded-box space-y-2 p-3">
              <CheckboxField
                id="landlord_approval"
                label="My landlord has approved a pet"
                registration={register('landlord_approval')}
                error={errors.landlord_approval?.message}
              />
              <TextField
                id="landlord_contact"
                label="Landlord contact"
                registration={register('landlord_contact')}
                error={errors.landlord_contact?.message}
                placeholder="Name, phone, or email"
              />
            </div>
          )}

          <CheckboxField
            id="has_yard"
            label="I have a yard"
            registration={register('has_yard')}
            error={errors.has_yard?.message}
          />
          {hasYard && (
            <CheckboxField
              id="yard_fenced"
              label="The yard is fenced"
              registration={register('yard_fenced')}
              error={errors.yard_fenced?.message}
            />
          )}
        </div>
      </fieldset>

      {/* 4 — Household & Pets */}
      <fieldset className="fieldset border-base-300 rounded-box w-full border p-4">
        <legend className="fieldset-legend px-2 text-base font-semibold">
          Household &amp; Pets
        </legend>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="household_adults"
              label="Adults in household"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              required
              registration={register('household_adults')}
              error={errors.household_adults?.message}
            />
            <TextField
              id="household_children"
              label="Children in household"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              required
              registration={register('household_children')}
              error={errors.household_children?.message}
            />
          </div>
          <TextAreaField
            id="other_pets"
            label="Other pets"
            registration={register('other_pets')}
            error={errors.other_pets?.message}
            placeholder="Species, ages, spay/neuter status…"
          />
        </div>
      </fieldset>

      {/* 5 — References & Experience */}
      <fieldset className="fieldset border-base-300 rounded-box w-full border p-4">
        <legend className="fieldset-legend px-2 text-base font-semibold">
          References &amp; Experience
        </legend>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              id="vet_name"
              label="Veterinarian name"
              registration={register('vet_name')}
              error={errors.vet_name?.message}
            />
            <TextField
              id="vet_phone"
              label="Veterinarian phone"
              type="tel"
              inputMode="tel"
              registration={register('vet_phone')}
              error={errors.vet_phone?.message}
            />
          </div>
          <TextAreaField
            id="experience"
            label="Pet experience"
            registration={register('experience')}
            error={errors.experience?.message}
            placeholder="Past pets, fostering, training…"
          />
          <TextAreaField
            id="why_this_pet"
            label="Why this pet?"
            registration={register('why_this_pet')}
            error={errors.why_this_pet?.message}
            placeholder="What makes this pet a good match for your home?"
          />
        </div>
      </fieldset>

      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={submitting}
        aria-busy={submitting || undefined}
      >
        {submitting && (
          <span
            className="loading loading-spinner loading-sm"
            aria-hidden="true"
          />
        )}
        Submit application
      </button>
    </form>
  );
}
