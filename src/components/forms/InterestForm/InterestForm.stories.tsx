import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { InterestForm } from './InterestForm';

const meta = {
  title: 'Features/Forms/InterestForm',
  component: InterestForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-base-100 min-h-screen max-w-lg p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InterestForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const DarkTheme: Story = {
  args: {},
  decorators: [
    (Story) => (
      <div
        className="bg-base-100 min-h-screen max-w-lg p-8"
        data-theme="trusted-care-dark"
      >
        <Story />
      </div>
    ),
  ],
};
