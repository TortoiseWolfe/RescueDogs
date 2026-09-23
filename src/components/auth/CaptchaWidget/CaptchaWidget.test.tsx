import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaptchaWidget, {
  turnstileSizeForViewport,
  TURNSTILE_FLEXIBLE_MIN_WIDTH_PX,
  type CaptchaWidgetHandle,
} from './CaptchaWidget';

// The real widget injects Cloudflare's script and renders a cross-origin
// iframe — neither works in jsdom. Stub it down to the surface this component
// actually drives: the success/expire/error callbacks and the reset handle.
const mockReset = vi.fn();
vi.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({
    siteKey,
    onSuccess,
    onExpire,
    onError,
    options,
    ref,
  }: {
    siteKey: string;
    onSuccess: (t: string) => void;
    onExpire: () => void;
    onError: () => void;
    options?: { size?: string };
    ref?: { current: { reset: () => void } | null };
  }) => {
    if (ref) ref.current = { reset: mockReset };
    return (
      <div
        data-testid="turnstile-stub"
        data-sitekey={siteKey}
        data-size={options?.size}
      >
        <button onClick={() => onSuccess('tok-abc')}>solve</button>
        <button onClick={() => onExpire()}>expire</button>
        <button onClick={() => onError()}>error</button>
      </div>
    );
  },
}));

const mockConfig = vi.hoisted(() => ({
  captchaConfig: { provider: 'turnstile', siteKey: undefined, enabled: false },
}));
vi.mock('@/config/captcha.config', () => mockConfig);

const configure = (siteKey?: string) => {
  mockConfig.captchaConfig.siteKey = siteKey as never;
  mockConfig.captchaConfig.enabled = Boolean(siteKey);
};

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('CaptchaWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configure(undefined);
    // Default to a desktop-width viewport so flexible is the measured size.
    stubMatchMedia(true);
  });

  // The load-bearing behaviour: unconfigured must be a complete no-op, or every
  // fork and local dev environment gets a permanently un-submittable form.
  it('renders nothing and emits no token when no site key is configured', () => {
    const onToken = vi.fn();
    const { container } = render(<CaptchaWidget onToken={onToken} />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('captcha-widget')).not.toBeInTheDocument();
    expect(onToken).not.toHaveBeenCalled();
  });

  it('renders the challenge with the configured site key', () => {
    configure('0x-site-key');
    render(<CaptchaWidget onToken={vi.fn()} />);

    expect(screen.getByTestId('captcha-widget')).toBeInTheDocument();
    expect(screen.getByTestId('turnstile-stub')).toHaveAttribute(
      'data-sitekey',
      '0x-site-key'
    );
    expect(screen.getByTestId('turnstile-stub')).toHaveAttribute(
      'data-size',
      'flexible'
    );
  });

  it('uses compact Turnstile when the viewport is narrower than the flex floor', () => {
    stubMatchMedia(false);
    configure('0x-site-key');
    render(<CaptchaWidget onToken={vi.fn()} />);

    expect(screen.getByTestId('turnstile-stub')).toHaveAttribute(
      'data-size',
      'compact'
    );
  });

  it('turnstileSizeForViewport keeps compact only on narrow phones', () => {
    expect(turnstileSizeForViewport(320)).toBe('compact');
    expect(turnstileSizeForViewport(TURNSTILE_FLEXIBLE_MIN_WIDTH_PX)).toBe(
      'flexible'
    );
    expect(turnstileSizeForViewport(1280)).toBe('flexible');
  });

  it('reports the token on success', async () => {
    configure('0x-site-key');
    const onToken = vi.fn();
    render(<CaptchaWidget onToken={onToken} />);

    screen.getByText('solve').click();
    expect(onToken).toHaveBeenCalledWith('tok-abc');
  });

  // Tokens are single-use and short-lived; a stale one would be rejected by
  // Supabase with a confusing error, so both paths must clear it.
  it.each(['expire', 'error'])('clears the token on %s', (event) => {
    configure('0x-site-key');
    const onToken = vi.fn();
    render(<CaptchaWidget onToken={onToken} />);

    screen.getByText(event).click();
    expect(onToken).toHaveBeenCalledWith(null);
  });

  it('reset() re-challenges and clears the token', () => {
    configure('0x-site-key');
    const onToken = vi.fn();
    const ref = createRef<CaptchaWidgetHandle>();
    render(<CaptchaWidget ref={ref} onToken={onToken} />);

    ref.current?.reset();

    expect(mockReset).toHaveBeenCalled();
    expect(onToken).toHaveBeenCalledWith(null);
  });

  it('applies a custom className', () => {
    configure('0x-site-key');
    const { container } = render(
      <CaptchaWidget onToken={vi.fn()} className="custom-test-class" />
    );
    expect(container.querySelector('.custom-test-class')).toBeInTheDocument();
  });
});
