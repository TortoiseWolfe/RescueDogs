import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PortalChooser from './PortalChooser';

const meta: Meta<typeof PortalChooser> = {
  title: 'Components/Molecular/PortalChooser',
  component: PortalChooser,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Adopter vs shelter portal chooser. Preference is local only; membership controls access after sign-in.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    showDemoHints: {
      control: 'boolean',
      description: 'Show short demo prefill hint (no credential list)',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const WithDemoHints: Story = {
  args: {
    showDemoHints: true,
  },
};
