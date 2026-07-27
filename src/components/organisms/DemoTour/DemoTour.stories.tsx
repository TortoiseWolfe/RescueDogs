import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import DemoTour from './DemoTour';

const meta: Meta<typeof DemoTour> = {
  title: 'Components/Organisms/DemoTour',
  component: DemoTour,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Short, dismissible demo callouts for adopter and shelter sessions (#68). Only appears when demo mode is active.',
      },
    },
    nextjs: {
      navigation: {
        pathname: '/applications',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    forceDemoMode: { control: 'boolean' },
    forceRole: {
      control: 'radio',
      options: ['adopter', 'shelter'],
    },
    forcePathname: { control: 'text' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const AdopterApplications: Story = {
  args: {
    forceDemoMode: true,
    forceRole: 'adopter',
    forcePathname: '/applications',
  },
};

export const AdopterTracker: Story = {
  args: {
    forceDemoMode: true,
    forceRole: 'adopter',
    forcePathname: '/applications/status',
  },
};

export const ShelterPipeline: Story = {
  args: {
    forceDemoMode: true,
    forceRole: 'shelter',
    forcePathname: '/shelter',
  },
};

export const ShelterApplication: Story = {
  args: {
    forceDemoMode: true,
    forceRole: 'shelter',
    forcePathname: '/shelter/application',
  },
};

export const HiddenOutsideDemo: Story = {
  args: {
    forceDemoMode: false,
    forcePathname: '/applications',
  },
};
