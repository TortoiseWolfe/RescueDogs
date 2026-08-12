import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import SoftCoBrand from './SoftCoBrand';

const meta = {
  title: 'Components/Molecular/SoftCoBrand',
  component: SoftCoBrand,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Soft co-brand (#169): shelter name leads on adopt/status; Raised Paws as powered-by. Text only — logo/colors deferred.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    shelterName: {
      control: 'text',
      description: 'Shelter display name',
    },
    context: {
      control: 'select',
      options: ['apply', 'status'],
    },
  },
} satisfies Meta<typeof SoftCoBrand>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Apply: Story = {
  args: {
    shelterName: 'Second Chance Rescue',
    context: 'apply',
  },
};

export const Status: Story = {
  args: {
    shelterName: 'Second Chance Rescue',
    context: 'status',
  },
};
