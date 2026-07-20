import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PortalChooser from './PortalChooser';
import { PORTAL_PREFERENCE_KEY } from '@/lib/portal/portal-preference';

describe('PortalChooser', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders both portal doors', () => {
    render(<PortalChooser />);
    expect(
      screen.getByRole('link', { name: /continue as adopter/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /continue as shelter/i })
    ).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <PortalChooser className="custom-test-class" />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });

  it('saves portal preference when a door is clicked', () => {
    const onSelect = vi.fn();
    render(<PortalChooser onSelect={onSelect} />);
    const link = screen.getByRole('link', { name: /continue as shelter/i });
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    expect(window.localStorage.getItem(PORTAL_PREFERENCE_KEY)).toBe('shelter');
    expect(onSelect).toHaveBeenCalledWith('shelter');
  });

  it('shows a short prefill hint without credential dump (#62)', () => {
    render(<PortalChooser showDemoHints />);
    expect(
      screen.getByText(/we'll fill in the shared demo login/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('staff@demo.test')).not.toBeInTheDocument();
    expect(screen.queryByText('DemoPass123!')).not.toBeInTheDocument();
  });

  it('adds demo=1 to sign-in door hrefs when demoPrefill is set (#59)', () => {
    render(<PortalChooser demoPrefill />);
    expect(
      screen.getByRole('link', { name: /continue as adopter/i })
    ).toHaveAttribute('href', expect.stringContaining('demo=1'));
    expect(
      screen.getByRole('link', { name: /continue as shelter/i })
    ).toHaveAttribute('href', expect.stringContaining('demo=1'));
  });

  it('does not add demo=1 to sign-up door hrefs even with demoPrefill', () => {
    render(<PortalChooser intent="sign-up" demoPrefill />);
    expect(
      screen.getByRole('link', { name: /create adopter account/i })
    ).toHaveAttribute('href', expect.not.stringContaining('demo=1'));
  });

  it('routes doors to sign-up when intent is sign-up', () => {
    render(<PortalChooser intent="sign-up" />);
    expect(
      screen.getByRole('link', { name: /create adopter account/i })
    ).toHaveAttribute('href', expect.stringContaining('/sign-up'));
  });
});
