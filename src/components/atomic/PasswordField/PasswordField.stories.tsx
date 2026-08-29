import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PasswordField } from './PasswordField';

const meta = {
  title: 'Components/Atomic/PasswordField',
  component: PasswordField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PasswordField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: 'password-story',
    placeholder: '••••••••',
    'aria-label': 'Password',
  },
  render: (args) => (
    <div className="w-80">
      <PasswordField {...args} />
    </div>
  ),
};
