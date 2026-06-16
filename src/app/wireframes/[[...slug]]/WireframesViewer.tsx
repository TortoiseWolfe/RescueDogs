'use client';

import { useEffect, useRef, useState } from 'react';
import { getAssetUrl } from '@/config/project.config';

interface WireframesViewerProps {
  /**
   * Manifest path of the SVG to deep-link to ("<feature>/<file>.svg"), or
   * null for the index view. Passed straight through to the viewer iframe as
   * a URL hash, which viewer.html reads on load and via hashchange.
   */
  wireframePath: string | null;
}

/**
 * Embeds the manifest-driven wireframe viewer (viewer.html) in an iframe.
 * When a wireframePath is provided, it is appended as the iframe's hash so
 * the viewer opens directly on that SVG — the deep-link contract.
 */
export default function WireframesViewer({
  wireframePath,
}: WireframesViewerProps) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const base = getAssetUrl('/wireframes/viewer.html');
  const iframeSrc = wireframePath ? `${base}#${wireframePath}` : base;

  // Iframe's load event races with React hydration — if the iframe finishes
  // loading before React attaches onLoad, the spinner sticks forever.
  // After mount, check readyState directly to catch the already-loaded case.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.contentDocument?.readyState === 'complete') {
      setLoading(false);
    }
  }, []);

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full">
      {loading && (
        <div className="bg-base-200 absolute inset-0 z-10 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Wireframe Viewer"
        className="h-full w-full border-0"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
