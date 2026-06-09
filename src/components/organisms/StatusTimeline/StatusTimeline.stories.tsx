import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type {
  ApplicationStatus,
  StatusHistoryEntry,
} from '@/types/applications';
import StatusTimeline from './StatusTimeline';

let seq = 0;

function entry(
  to_status: ApplicationStatus,
  created_at: string,
  overrides: Partial<StatusHistoryEntry> = {}
): StatusHistoryEntry {
  seq += 1;
  return {
    id: `history-${seq}`,
    application_id: 'app-1',
    from_status: null,
    to_status,
    changed_by: null,
    note: null,
    created_at,
    ...overrides,
  };
}

const meta = {
  title: 'Components/Organisms/StatusTimeline',
  component: StatusTimeline,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The "pizza tracker" for an adoption application. Shows the five pipeline stages (submitted → approved) as DaisyUI steps with progress highlighted; terminal branches (not_selected, withdrawn) replace the final Approved step. Below the steps, the status history lists each update with its date and any adopter-visible shelter note.',
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
      description: "The application's current status",
    },
    history: {
      control: 'object',
      description: 'Status change history entries (rendered oldest first)',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof StatusTimeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const JustSubmitted: Story = {
  args: {
    currentStatus: 'submitted',
    history: [entry('submitted', '2026-06-01T09:15:00Z')],
  },
  parameters: {
    docs: {
      description: {
        story:
          'A freshly submitted application: only the first step is highlighted.',
      },
    },
  },
};

export const MidPipeline: Story = {
  args: {
    currentStatus: 'reference_check',
    history: [
      entry('submitted', '2026-05-20T09:15:00Z'),
      entry('under_review', '2026-05-22T14:30:00Z', {
        from_status: 'submitted',
        note: "We're reviewing your application — expect an update within a few days.",
      }),
      entry('reference_check', '2026-05-27T10:05:00Z', {
        from_status: 'under_review',
        note: "We'll be calling your vet this week.",
      }),
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'An application progressing through the pipeline, with shelter notes shown as chat bubbles in the history.',
      },
    },
  },
};

export const Approved: Story = {
  args: {
    currentStatus: 'approved',
    history: [
      entry('submitted', '2026-05-01T09:15:00Z'),
      entry('under_review', '2026-05-03T11:00:00Z', {
        from_status: 'submitted',
      }),
      entry('reference_check', '2026-05-06T15:45:00Z', {
        from_status: 'under_review',
      }),
      entry('home_visit', '2026-05-10T13:20:00Z', {
        from_status: 'reference_check',
        note: 'Home visit scheduled for Saturday at 10am.',
      }),
      entry('approved', '2026-05-15T16:00:00Z', {
        from_status: 'home_visit',
        note: 'Congratulations! Biscuit is ready to come home. Call us to arrange pickup.',
      }),
    ],
  },
  parameters: {
    docs: {
      description: {
        story: 'A fully approved application: the final step turns success.',
      },
    },
  },
};

export const NotSelected: Story = {
  args: {
    currentStatus: 'not_selected',
    history: [
      entry('submitted', '2026-05-01T09:15:00Z'),
      entry('under_review', '2026-05-03T11:00:00Z', {
        from_status: 'submitted',
      }),
      entry('home_visit', '2026-05-08T13:20:00Z', {
        from_status: 'under_review',
      }),
      entry('not_selected', '2026-05-12T17:30:00Z', {
        from_status: 'home_visit',
        note: 'Another applicant was a better fit for Biscuit this time. We would love to see you apply for other pets!',
      }),
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'A staff decision ends the application: the terminal step replaces Approved in error color, with the shelter note explaining why.',
      },
    },
  },
};

export const Withdrawn: Story = {
  args: {
    currentStatus: 'withdrawn',
    history: [
      entry('submitted', '2026-05-01T09:15:00Z'),
      entry('under_review', '2026-05-03T11:00:00Z', {
        from_status: 'submitted',
      }),
      entry('withdrawn', '2026-05-05T08:45:00Z', {
        from_status: 'under_review',
      }),
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'The adopter withdrew their application: the terminal step replaces Approved in neutral color.',
      },
    },
  },
};
