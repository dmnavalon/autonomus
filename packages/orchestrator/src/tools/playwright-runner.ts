/**
 * Inline Playwright runner. The orchestrator runtime has playwright installed,
 * so we can write the LLM-generated spec files to a tmp dir and execute them
 * with PLAYWRIGHT_BASE_URL pointing at the Vercel Preview.
 *
 * Returns a structured result that maps 1:1 to PlaywrightExecutionOutput.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import type { PlaywrightExecutionOutput } from '../schemas/index.js';

export interface RunOptions {
  previewUrl: string;
  specs: Array<{ filename: string; content: string }>;
  /** ms; default 5 minutes */
  timeoutMs?: number;
}

export interface RunResult {
  output: PlaywrightExecutionOutput;
  logExtract: string;
  workdir: string;
}

/**
 * Minimal playwright config — overrides base URL via env, retains traces on failure.
 * Vercel previews sit behind Vercel Authentication on protected projects; the
 * automation bypass header lets the tests through (docs: Protection Bypass for
 * Automation). The header is only injected when the secret env var is present
 * at test-run time.
 */
export function renderPlaywrightConfig(): string {
  return `import { defineConfig } from '@playwright/test';
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 1,
  reporter: [['json', { outputFile: 'results.json' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(bypass
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': bypass,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
});
`;
}

export async function runPlaywrightInline(opts: RunOptions): Promise<RunResult> {
  const workdir = join(tmpdir(), `pw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  mkdirSync(join(workdir, 'e2e'), { recursive: true });

  writeFileSync(join(workdir, 'playwright.config.ts'), renderPlaywrightConfig());

  for (const s of opts.specs) {
    writeFileSync(join(workdir, 'e2e', s.filename), s.content);
  }

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const exitCode = await new Promise<number>((resolve) => {
    const child = spawn('npx', ['playwright', 'test'], {
      cwd: workdir,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: opts.previewUrl,
        CI: '1',
      },
    });
    const t = setTimeout(() => child.kill('SIGKILL'), opts.timeoutMs ?? 5 * 60_000);
    child.stdout.on('data', (d) => stdoutChunks.push(d.toString()));
    child.stderr.on('data', (d) => stderrChunks.push(d.toString()));
    child.on('close', (code) => {
      clearTimeout(t);
      resolve(code ?? 1);
    });
  });

  const stdout = stdoutChunks.join('');
  const stderr = stderrChunks.join('');
  const logFull = stdout + '\n' + stderr;

  const resultsPath = join(workdir, 'results.json');
  let output: PlaywrightExecutionOutput;
  if (existsSync(resultsPath)) {
    const raw = readFileSync(resultsPath, 'utf8');
    const json = JSON.parse(raw) as PlaywrightJsonReport;
    const stats = json.stats ?? { expected: 0, unexpected: 0, skipped: 0, duration: 0 };
    const fallos: PlaywrightExecutionOutput['fallos'] = [];
    for (const suite of json.suites ?? []) {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const failedRun = (test.results ?? []).find((r) => r.status === 'failed');
          if (failedRun) {
            fallos.push({
              nombre: test.title || spec.title,
              error_resumen: (failedRun.error?.message ?? 'unknown error').slice(0, 200),
              trace_artifact: workdir,
            });
          }
        }
      }
    }
    output = {
      estado: stats.unexpected === 0 && exitCode === 0 ? 'passed' : 'failed',
      totales: {
        ran: stats.expected + stats.unexpected + stats.skipped,
        passed: stats.expected,
        failed: stats.unexpected,
        skipped: stats.skipped,
      },
      fallos,
      duration_ms: Math.round(stats.duration ?? 0),
    };
  } else {
    output = {
      estado: 'failed',
      totales: { ran: 0, passed: 0, failed: 0, skipped: 0 },
      fallos: [
        {
          nombre: 'playwright_did_not_emit_results',
          error_resumen: stderr.slice(-200) || stdout.slice(-200) || 'no results.json produced',
          trace_artifact: workdir,
        },
      ],
      duration_ms: 0,
    };
  }

  // Compress log to last 200 lines for the Analista
  const lines = logFull.split('\n');
  const tail = lines.slice(-200).join('\n');
  return { output, logExtract: tail, workdir };
}

interface PlaywrightJsonReport {
  stats?: { expected: number; unexpected: number; skipped: number; duration: number };
  suites?: Array<{
    specs?: Array<{
      title: string;
      tests?: Array<{
        title?: string;
        results?: Array<{
          status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
          error?: { message?: string };
        }>;
      }>;
    }>;
  }>;
}
