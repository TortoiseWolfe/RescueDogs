import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { ApplicationQuestion } from '@/types/applications';
import { BankQuestionField } from './BankQuestionField';

expect.extend(toHaveNoViolations);

function question(
  overrides: Partial<ApplicationQuestion>
): ApplicationQuestion {
  return {
    id: 'yrd.other_containment',
    category: 'yard',
    sort_order: 604,
    wording: 'Do you use any other outdoor containment?',
    answer_type: 'multi_choice',
    choices: [
      { value: 'none', label: 'None' },
      { value: 'electric_fence', label: 'Underground or electric fence' },
    ],
    fields: null,
    follow_up: null,
    show_if: null,
    parent_id: null,
    species: 'any',
    pet_tag: null,
    sensitivity: 'normal',
    is_locked: false,
    is_flaggable: false,
    always_optional: false,
    retired_at: null,
    ...overrides,
  };
}

const noop = () => undefined;

const contactFields = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'phone' },
];

describe('BankQuestionField accessible names (#465)', () => {
  it('names a multi_choice group with the question and marks it required', () => {
    const { container } = render(
      <BankQuestionField
        question={question({})}
        value={[]}
        onChange={noop}
        visibleBank={[]}
      />
    );
    const group = screen.getByRole('group', {
      name: /Do you use any other outdoor containment\?.*required/,
    });
    expect(
      within(group).getByRole('checkbox', {
        name: 'Underground or electric fence',
      })
    ).toBeTruthy();
    // The wording is a legend now, not a label pointing at an id nothing has.
    expect(container.querySelectorAll('label[for]')).toHaveLength(0);
  });

  it('gives two contact questions distinct group names', () => {
    render(
      <>
        <BankQuestionField
          question={question({
            id: 'hou.landlord_contact',
            wording: 'Landlord or property manager: name and phone',
            answer_type: 'contact',
            choices: null,
            fields: contactFields,
          })}
          value={null}
          onChange={noop}
          visibleBank={[]}
        />
        <BankQuestionField
          question={question({
            id: 'vet.contact',
            wording: 'Current or previous veterinarian or clinic',
            answer_type: 'contact',
            choices: null,
            fields: contactFields,
          })}
          value={null}
          onChange={noop}
          visibleBank={[]}
        />
      </>
    );
    const landlord = screen.getByRole('group', { name: /Landlord/ });
    const vet = screen.getByRole('group', { name: /veterinarian/ });
    expect(
      within(landlord).getByRole('textbox', { name: 'Phone' })
    ).toBeTruthy();
    expect(within(vet).getByRole('textbox', { name: 'Phone' })).toBeTruthy();
  });

  it('names each repeat row and its Remove button, and passes axe', async () => {
    const { container } = render(
      <BankQuestionField
        question={question({
          id: 'ref.personal',
          wording: 'Personal references',
          answer_type: 'repeat',
          choices: null,
          fields: [{ key: 'name', label: 'Name', type: 'text' }],
        })}
        value={{ rows: [{}, {}] }}
        onChange={noop}
        visibleBank={[]}
      />
    );
    expect(screen.getByRole('group', { name: 'Entry 1' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Entry 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove entry 2' })).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('links the error to the group and to a single control', () => {
    const { rerender } = render(
      <BankQuestionField
        question={question({})}
        value={[]}
        onChange={noop}
        visibleBank={[]}
        error="Pick at least one."
      />
    );
    const group = screen.getByRole('group', {
      name: /Do you use any other outdoor containment/,
    });
    const alert = screen.getByRole('alert');
    expect(group.getAttribute('aria-describedby')).toBe(alert.id);
    expect(alert.id).not.toBe('');

    rerender(
      <BankQuestionField
        question={question({
          id: 'con.full_name',
          wording: 'Full name',
          answer_type: 'text',
          choices: null,
        })}
        value=""
        onChange={noop}
        visibleBank={[]}
        error="Required."
      />
    );
    const input = screen.getByRole('textbox', { name: /Full name/ });
    expect(input.getAttribute('aria-describedby')).toBe(
      screen.getByRole('alert').id
    );
  });

  it('keeps the label for a single-control question and the textarea fallback name', () => {
    render(
      <>
        <BankQuestionField
          question={question({
            id: 'con.full_name',
            wording: 'Full name',
            answer_type: 'text',
            choices: null,
          })}
          value=""
          onChange={noop}
          visibleBank={[]}
        />
        <BankQuestionField
          question={question({
            id: 'con.address',
            wording: 'Home address',
            answer_type: 'address',
            choices: null,
            fields: null,
          })}
          value={null}
          onChange={noop}
          visibleBank={[]}
        />
      </>
    );
    expect(screen.getByRole('textbox', { name: /Full name/ })).toBeTruthy();
    const address = screen.getByRole('group', { name: /Home address/ });
    expect(
      within(address).getByRole('textbox', { name: 'Your answer' })
    ).toBeTruthy();
  });
});
