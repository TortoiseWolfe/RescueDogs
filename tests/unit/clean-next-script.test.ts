/**
 * Unit tests for the package.json clean:next / test scripts (#401).
 *
 * A routine push runs the unit tests, and the tests used to start by emptying
 * ./.next, which is the running dev server's build output. These tests pin
 * that `pnpm test` no longer cleans, and that clean:next only empties the
 * folder named by NEXT_DIST_DIR (default .next).
 *
 * @module tests/unit/clean-next-script.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const pkg = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf8')
) as { scripts: Record<string, string> };

function runClean(cwd: string, env: Record<string, string>) {
  // pnpm runs package scripts with sh; do the same here.
  const cleanEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
  if (!('NEXT_DIST_DIR' in env)) delete cleanEnv.NEXT_DIST_DIR;
  execFileSync('sh', ['-c', pkg.scripts['clean:next']], {
    cwd,
    env: cleanEnv,
  });
}

describe('package.json scripts (#401)', () => {
  it('does not clean .next before running the unit tests', () => {
    expect(pkg.scripts.test).toBe('vitest');
  });

  it('still cleans before a production build', () => {
    expect(pkg.scripts.build).toContain('clean:next');
  });
});

describe('clean:next', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'clean-next-'));
    for (const d of ['.next', '.next-ci']) {
      mkdirSync(join(dir, d, 'cache'), { recursive: true });
      writeFileSync(join(dir, d, 'BUILD_ID'), 'x');
      writeFileSync(join(dir, d, '.hidden'), 'x');
      writeFileSync(join(dir, d, 'cache', 'chunk.js'), 'x');
    }
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('empties only NEXT_DIST_DIR when it is set', () => {
    runClean(dir, { NEXT_DIST_DIR: '.next-ci' });

    expect(existsSync(join(dir, '.next-ci', 'BUILD_ID'))).toBe(false);
    expect(existsSync(join(dir, '.next-ci', '.hidden'))).toBe(false);
    expect(existsSync(join(dir, '.next-ci', 'cache'))).toBe(false);
    expect(existsSync(join(dir, '.next', 'BUILD_ID'))).toBe(true);
    expect(existsSync(join(dir, '.next', '.hidden'))).toBe(true);
    expect(existsSync(join(dir, '.next', 'cache', 'chunk.js'))).toBe(true);
  });

  it('empties .next by default and leaves other folders alone', () => {
    runClean(dir, {});

    expect(existsSync(join(dir, '.next', 'BUILD_ID'))).toBe(false);
    expect(existsSync(join(dir, '.next', '.hidden'))).toBe(false);
    expect(existsSync(join(dir, '.next-ci', 'BUILD_ID'))).toBe(true);
  });
});
