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

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signOut: vi.fn(),
    user: { id: 'demo-user' },
  }),
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
    expect(screen.getByText('Start as the adopter')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Open Tiger/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('demo-tour-switch-role')).toHaveTextContent(
      /shelter demo/i
    );
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
    expect(screen.getByText('Then switch to the shelter')).toBeInTheDocument();
  });

  it('keeps the switch control after Skip tour', () => {
    render(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications"
      />
    );
    fireEvent.click(screen.getByTestId('demo-tour-skip'));
    expect(screen.queryByText('Start as the adopter')).not.toBeInTheDocument();
    expect(screen.getByTestId('demo-tour-switch-role')).toBeInTheDocument();
    expect(window.localStorage.getItem(DEMO_TOUR_DISMISS_KEY)).toContain(
      'adopter'
    );
  });

  it('shows switch-only chrome when previously dismissed', () => {
    setTourDismissed('shelter', true);
    render(
      <DemoTour forceDemoMode forceRole="shelter" forcePathname="/shelter" />
    );
    expect(
      screen.queryByText('Shelter side of the demo')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('demo-tour-switch-role')).toHaveTextContent(
      /adopter demo/i
    );
  });

  it('invokes onSwitchRole when the switch button is clicked', async () => {
    const onSwitchRole = vi.fn();
    render(
      <DemoTour
        forceDemoMode
        forceRole="adopter"
        forcePathname="/applications"
        onSwitchRole={onSwitchRole}
      />
    );
    fireEvent.click(screen.getByTestId('demo-tour-switch-role'));
    expect(onSwitchRole).toHaveBeenCalledTimes(1);
  });
});
