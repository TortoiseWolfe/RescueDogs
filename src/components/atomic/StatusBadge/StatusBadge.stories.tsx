import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { STATUS_ORDER, TERMINAL_STATUSES } from '@/types/applications';
import StatusBadge from './StatusBadge';

const meta = {
  title: 'Components/Atomic/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'DaisyUI badge showing an adoption application status with a per-status color variant. Active pipeline statuses progress submitted → approved; terminal branches are not_selected (staff) and withdrawn (adopter).',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
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
      description: 'Application status to display',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    status: 'submitted',
  },
};

export const ActiveStatuses: Story = {
  args: {
    status: 'submitted',
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_ORDER.filter((status) => status !== 'approved').map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The in-progress pipeline stages an application moves through before reaching a terminal state.',
      },
    },
  },
};

export const TerminalStatuses: Story = {
  args: {
    status: 'approved',
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {TERMINAL_STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Terminal outcomes: approved (success), not_selected (staff decision), withdrawn (adopter decision).',
      },
    },
  },
};

export const WithCustomClass: Story = {
  args: {
    status: 'home_visit',
    className: 'badge-lg',
  },
};
