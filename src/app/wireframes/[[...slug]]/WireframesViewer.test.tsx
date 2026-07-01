import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import WireframesViewer from './WireframesViewer';

/**
 * Pins the deep-link contract between the /wireframes route and the embedded
 * viewer.html: a manifest path is passed through as the iframe's URL hash,
 * which viewer.html reads on load to open directly on that SVG. The absence
 * of a path must yield the bare viewer URL (the index view).
 *
 * getAssetUrl is mocked to the identity-with-leading-slash so the assertions
 * are independent of the project's basePath.
 */
vi.mock('@/config/project.config', () => ({
  getAssetUrl: (path: string) => path,
}));

function iframeSrc(): string {
  const iframe = screen.getByTitle('Wireframe Viewer') as HTMLIFrameElement;
  return iframe.getAttribute('src') ?? '';
}

describe('WireframesViewer', () => {
  it('appends the wireframe path as a hash for deep-linking', () => {
    render(
      <WireframesViewer wireframePath="core-features-048-rescue-mvp/03-status-tracker.svg" />
    );
    expect(iframeSrc()).toBe(
      '/wireframes/viewer.html#core-features-048-rescue-mvp/03-status-tracker.svg'
    );
  });

  it('renders the bare viewer URL (no hash) for the index view', () => {
    render(<WireframesViewer wireframePath={null} />);
    expect(iframeSrc()).toBe('/wireframes/viewer.html');
    expect(iframeSrc()).not.toContain('#');
  });

  it('preserves a path that itself contains slashes and the .svg suffix', () => {
    render(
      <WireframesViewer wireframePath="auth-oauth-016-messaging-critical-fixes/01-conversation-view.svg" />
    );
    expect(iframeSrc()).toBe(
      '/wireframes/viewer.html#auth-oauth-016-messaging-critical-fixes/01-conversation-view.svg'
    );
  });
});
