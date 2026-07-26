import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DemoTour from './DemoTour';
import {
  DEMO_TOUR_DISMISS_KEY,
  enterDemoMode,
  setTourDismissed,
} from '@/lib/demo/demo-session';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/applications'),
}));

describe('DemoTour', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    enterDemoMode('adopter');
  });

  it('renders nothing when not in demo mode', () => {
    window.sessionStorage.clear();
    const { container } = render(<DemoTour forcePathname="/applications" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows adopter step 1 on /applications', () => {
    render(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications"
      />
    );
    expect(screen.getByTestId('demo-tour')).toBeInTheDocument();
    expect(screen.getByText('Your applications')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Open Biscuit/i })
    ).toBeInTheDocument();
  });

  it('advances to the next step on Next', () => {
    render(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications/status"
      />
    );
    expect(screen.getByText('Status tracker')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('demo-tour-next'));
    expect(screen.getByText('Live updates')).toBeInTheDocument();
  });

  it('hides after Skip tour and persists dismissal', () => {
    const { container, rerender } = render(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications"
      />
    );
    fireEvent.click(screen.getByTestId('demo-tour-skip'));
    expect(container.firstChild).toBeNull();
    expect(window.localStorage.getItem(DEMO_TOUR_DISMISS_KEY)).toContain(
      'adopter'
    );
    rerender(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('stays hidden when previously dismissed', () => {
    setTourDismissed('shelter', true);
    const { container } = render(
      <DemoTour forceDemoMode forceRole="shelter" forcePathname="/shelter" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows shelter pipeline step', () => {
    render(
      <DemoTour forceDemoMode forceRole="shelter" forcePathname="/shelter" />
    );
    expect(screen.getByTestId('demo-tour')).toHaveAttribute(
      'data-tour-role',
      'shelter'
    );
    expect(screen.getByText('Shelter pipeline')).toBeInTheDocument();
  });
});
