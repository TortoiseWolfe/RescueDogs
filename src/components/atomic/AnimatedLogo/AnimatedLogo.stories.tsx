import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AnimatedLogo } from './AnimatedLogo';

const meta: Meta<typeof AnimatedLogo> = {
  title: 'Components/Atomic/AnimatedLogo',
  component: AnimatedLogo,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'An animated logo component with hover effects where letters pop up in sequence.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    text: {
      control: 'text',
      description: 'The text to display in the animated logo',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes to apply',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl', '2xl', '3xl'],
      description: 'Size of the logo text',
    },
    animationSpeed: {
      control: 'select',
      options: ['slow', 'normal', 'fast'],
      description: 'Speed of the animation',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AnimatedLogo>;

export const Default: Story = {
  args: {
    text: 'Raised Paws',
    size: 'xl',
    animationSpeed: 'normal',
  },
};

export const SmallSize: Story = {
  args: {
    text: 'Small Logo',
    size: 'sm',
    animationSpeed: 'normal',
  },
};

export const LargeSize: Story = {
  args: {
    text: 'Big Logo',
    size: '3xl',
    animationSpeed: 'normal',
  },
};

export const SlowAnimation: Story = {
  args: {
    text: 'Slow Motion',
    size: 'xl',
    animationSpeed: 'slow',
  },
};

export const FastAnimation: Story = {
  args: {
    text: 'Fast Motion',
    size: 'xl',
    animationSpeed: 'fast',
  },
};

export const CustomText: Story = {
  args: {
    text: 'Your App Name',
    size: 'xl',
    animationSpeed: 'normal',
  },
};

export const WithCustomClass: Story = {
  args: {
    text: 'Styled Logo',
    size: 'xl',
    animationSpeed: 'normal',
    className: 'text-blue-500',
  },
};

export const LongText: Story = {
  args: {
    text: 'This Is A Really Long Application Name',
    size: 'md',
    animationSpeed: 'normal',
  },
};

export const ThemeShowcase: Story = {
  args: {
    text: 'Raised Paws',
  },
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-base-content/80 mb-2 text-sm">
          Uses text-primary — adapts to current theme
        </p>
        <AnimatedLogo text="Raised Paws" size="2xl" />
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-base-content/80 text-sm">All sizes</p>
        <AnimatedLogo text="Raised Paws" size="sm" />
        <AnimatedLogo text="Raised Paws" size="md" />
        <AnimatedLogo text="Raised Paws" size="lg" />
        <AnimatedLogo text="Raised Paws" size="xl" />
      </div>
      <div>
        <p className="text-base-content/80 mb-2 text-sm">On neutral surface</p>
        <div className="bg-neutral rounded-box inline-block p-6">
          <AnimatedLogo text="Raised Paws" size="xl" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
