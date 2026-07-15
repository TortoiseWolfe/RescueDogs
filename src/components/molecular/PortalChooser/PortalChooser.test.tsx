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

  it('shows demo hints when requested', () => {
    render(<PortalChooser showDemoHints />);
    expect(screen.getByText(/try the live demo loop/i)).toBeInTheDocument();
    expect(screen.getByText('staff@demo.test')).toBeInTheDocument();
  });

  it('routes doors to sign-up when intent is sign-up', () => {
    render(<PortalChooser intent="sign-up" />);
    expect(
      screen.getByRole('link', { name: /create adopter account/i })
    ).toHaveAttribute('href', expect.stringContaining('/sign-up'));
  });
});
