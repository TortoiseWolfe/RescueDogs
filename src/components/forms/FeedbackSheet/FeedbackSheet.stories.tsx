import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FeedbackSheet from './FeedbackSheet';

const meta: Meta<typeof FeedbackSheet> = {
  title: 'Features/Forms/FeedbackSheet',
  component: FeedbackSheet,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One field, one button, and a sentence saying exactly what else is being sent. ' +
          'Opened by FeedbackLink; see docs/features/feedback-loop.md.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: { control: 'boolean', description: 'Whether the sheet is open' },
    onClose: {
      action: 'closed',
      description: 'Called when the sheet is dismissed',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { isOpen: true },
};

/**
 * Closed is a real state worth a story: `<dialog>` renders nothing until `showModal()`,
 * so this is what every page carrying the control looks like almost all of the time.
 */
export const Closed: Story = {
  args: { isOpen: false },
};
