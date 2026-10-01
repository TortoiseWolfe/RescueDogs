import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FeedbackLink from './FeedbackLink';

const meta: Meta<typeof FeedbackLink> = {
  title: 'Components/Atomic/FeedbackLink',
  component: FeedbackLink,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'The way to say the software is wrong, for somebody signed in. Opens FeedbackSheet. ' +
          'Not /contact, which is for writing to the rescue — see docs/features/feedback-loop.md.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    className: { control: 'text', description: 'Additional CSS classes' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};
