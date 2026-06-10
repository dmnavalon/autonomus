import { describe, it, expect } from 'vitest';
import { renderPlaywrightConfig } from '../../packages/orchestrator/src/tools/playwright-runner';

describe('playwright config — Vercel Authentication bypass', () => {
  it('wires the automation bypass header from the env var', () => {
    const config = renderPlaywrightConfig();
    expect(config).toContain('process.env.VERCEL_AUTOMATION_BYPASS_SECRET');
    expect(config).toContain("'x-vercel-protection-bypass': bypass");
    expect(config).toContain("'x-vercel-set-bypass-cookie': 'true'");
  });

  it('keeps base URL injection and failure artifacts', () => {
    const config = renderPlaywrightConfig();
    expect(config).toContain('process.env.PLAYWRIGHT_BASE_URL');
    expect(config).toContain("trace: 'retain-on-failure'");
    expect(config).toContain("outputFile: 'results.json'");
  });
});
