#!/usr/bin/env node

/**
 * Generate PWA manifest.json at build time
 * This replaces the dynamic API route for static export compatibility.
 *
 * Branding uses the product display name (Raised Paws), never the GitHub
 * repo slug (RescueDogs). Keep in sync with generateManifest() in
 * src/config/project.config.ts (#162).
 */

const fs = require('fs');
const path = require('path');

// Load project configuration
const projectConfigPath = path.join(
  __dirname,
  '../src/config/project-detected.json'
);
let projectConfig = {
  // Repo slug — used only for GitHub URLs / packaging, not PWA branding
  projectName: 'RescueDogs',
  projectDisplayName: 'Raised Paws',
  projectTagline: 'Pet Adoption Application Tracker',
  projectDescription:
    'Pet adoption application tracker for shelters, adopters, and live status updates',
  projectOwner: 'TortoiseWolfe',
  basePath: '',
};

// Try to load the auto-detected configuration
if (fs.existsSync(projectConfigPath)) {
  try {
    const detected = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
    projectConfig = {
      ...projectConfig,
      ...detected,
      // Detection only knows the repo slug — never let it overwrite brand
      projectDisplayName:
        detected.projectDisplayName || projectConfig.projectDisplayName,
      projectTagline: detected.projectTagline || projectConfig.projectTagline,
      projectDescription:
        detected.projectDescription || projectConfig.projectDescription,
    };
  } catch (error) {
    console.warn(
      'Warning: Could not load project-detected.json:',
      error.message
    );
  }
}

// Use environment variables if available (highest priority)
if (process.env.NEXT_PUBLIC_PROJECT_NAME) {
  projectConfig.projectName = process.env.NEXT_PUBLIC_PROJECT_NAME;
}
if (process.env.NEXT_PUBLIC_PROJECT_DISPLAY_NAME) {
  projectConfig.projectDisplayName =
    process.env.NEXT_PUBLIC_PROJECT_DISPLAY_NAME;
}
if (process.env.NEXT_PUBLIC_PROJECT_OWNER) {
  projectConfig.projectOwner = process.env.NEXT_PUBLIC_PROJECT_OWNER;
}
if (process.env.NEXT_PUBLIC_BASE_PATH !== undefined) {
  projectConfig.basePath = process.env.NEXT_PUBLIC_BASE_PATH;
}

const basePath = projectConfig.basePath || '';
const displayName = projectConfig.projectDisplayName;

// display: browser — intentionally not installable as a PWA (#162).
// Chrome's Install mini-infobar requires standalone|fullscreen|minimal-ui.
const manifest = {
  name: `${displayName} — ${projectConfig.projectTagline}`,
  short_name: displayName,
  description: projectConfig.projectDescription,
  theme_color: '#1e3a8a',
  background_color: '#ffffff',
  display: 'browser',
  start_url: `${basePath}/`,
  scope: `${basePath}/`,
  orientation: 'portrait-primary',
  categories: ['lifestyle', 'productivity', 'utilities'],
  lang: 'en',
  dir: 'ltr',
  prefer_related_applications: false,
  icons: [
    {
      src: `${basePath}/favicon.svg`,
      sizes: 'any',
      type: 'image/svg+xml',
    },
    {
      src: `${basePath}/icon-192x192.svg`,
      sizes: '192x192',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${basePath}/icon-512x512.svg`,
      sizes: '512x512',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: `${basePath}/icon-maskable.svg`,
      sizes: '512x512',
      type: 'image/svg+xml',
      purpose: 'maskable',
    },
  ],
  screenshots: [
    {
      src: `${basePath}/screenshots/desktop.png`,
      sizes: '1920x1080',
      type: 'image/png',
      form_factor: 'wide',
      label: 'Desktop view',
    },
    {
      src: `${basePath}/screenshots/mobile.png`,
      sizes: '390x844',
      type: 'image/png',
      form_factor: 'narrow',
      label: 'Mobile view',
    },
  ],
  shortcuts: [
    {
      name: 'Adopt',
      url: `${basePath}/adopt/`,
      description: 'Start a universal adoption application',
    },
    {
      name: 'My applications',
      url: `${basePath}/applications/`,
      description: 'Track your adoption applications',
    },
    {
      name: 'Sign In',
      url: `${basePath}/sign-in/`,
      description: `Sign In to ${displayName}`,
    },
  ],
};

// Write manifest to public directory
const outputPath = path.join(__dirname, '../public/manifest.json');
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`✅ Generated manifest.json for ${displayName}`);
console.log(`   Base path: ${basePath || '/'}`);
console.log(`   Display mode: ${manifest.display} (not installable)`);
console.log(`   Output: ${outputPath}`);
