import fs from 'fs/promises';
import path from 'path';
import WireframesViewer from './WireframesViewer';

interface ManifestWireframe {
  path: string; // "<feature-folder>/<svg-file>.svg"
}

interface WireframeManifest {
  wireframes?: ManifestWireframe[];
}

/**
 * Read the build-time wireframe manifest (produced by
 * scripts/sync-wireframes.sh into public/wireframes/). Used to prerender one
 * static page per SVG so `/wireframes/<feature>/<svg>` deep-links resolve
 * under static export.
 */
async function readManifestPaths(): Promise<string[]> {
  try {
    const manifestPath = path.join(
      process.cwd(),
      'public/wireframes/wireframes-manifest.json'
    );
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as WireframeManifest;
    return (manifest.wireframes ?? [])
      .map((wf) => wf.path)
      .filter((p): p is string => typeof p === 'string' && p.length > 0);
  } catch {
    // Manifest absent (e.g. sync not run) — the index page still renders.
    return [];
  }
}

/**
 * Static params for the optional catch-all:
 * - `[]` (no slug)  → the index viewer (`/wireframes`)
 * - `[feature, file]` → a deep-linked SVG (`/wireframes/<feature>/<file>`)
 *
 * The `.svg` extension is stripped from the slug. Keeping it would make the
 * route emit `out/wireframes/<feature>/<file>.svg/index.html`, colliding with
 * the real `<file>.svg` asset that sync-wireframes.sh copies to the same path
 * (EEXIST at export). The extension is restored when forming the iframe hash.
 */
export async function generateStaticParams() {
  const paths = await readManifestPaths();
  const params: Array<{ slug?: string[] }> = [{ slug: [] }];
  for (const p of paths) {
    const slug = p.replace(/\.svg$/, '').split('/');
    params.push({ slug });
  }
  return params;
}

// Reject any slug not in the manifest rather than rendering an empty viewer.
export const dynamicParams = false;

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function WireframesPage({ params }: PageProps) {
  const { slug } = await params;
  // Rejoin segments and restore the .svg extension dropped in the slug so the
  // value matches the manifest path the viewer keys on ("<feature>/<file>.svg").
  const wireframePath =
    slug && slug.length > 0 ? `${slug.join('/')}.svg` : null;
  return <WireframesViewer wireframePath={wireframePath} />;
}
