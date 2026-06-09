import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import StatusDropdown from './StatusDropdown';

const meta: Meta<typeof StatusDropdown> = {
  title: 'Components/Molecular/StatusDropdown',
  component: StatusDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Staff control to advance an adoption application through the status pipeline. Only the legal transitions from the current status are offered (STATUS_TRANSITIONS); terminal targets (Approved / Not Selected) require an inline confirmation step because they are final and immediately visible on the adopter tracker.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    currentStatus: {
      control: 'select',
      options: [
        'submitted',
        'under_review',
        'reference_check',
        'home_visit',
        'approved',
        'not_selected',
        'withdrawn',
      ],
      description: "The application's current pipeline status",
    },
    onAdvance: {
      description:
        'Called with the chosen target status and optional adopter-visible note',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable all controls',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Newly submitted application: two legal targets (Under Review, Not Selected). */
export const Submitted: Story = {
  args: {
    currentStatus: 'submitted',
    onAdvance: fn(),
  },
};

/**
 * Mid-pipeline application: four legal targets (Reference Check, Home
 * Visit, Approved, Not Selected).
 */
export const UnderReview: Story = {
  args: {
    currentStatus: 'under_review',
    onAdvance: fn(),
  },
};

/** Terminal status: no select, just the quiet "No further actions" state. */
export const Terminal: Story = {
  args: {
    currentStatus: 'approved',
    onAdvance: fn(),
  },
};

/** All controls disabled, e.g. while a previous update is in flight. */
export const Disabled: Story = {
  args: {
    currentStatus: 'under_review',
    onAdvance: fn(),
    disabled: true,
  },
};
