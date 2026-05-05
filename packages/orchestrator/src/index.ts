/**
 * Autonomus orchestrator — CLI entrypoint.
 *
 *   node packages/orchestrator/dist/index.js run-job <issue-number>
 *
 * Designed to be invoked from .github/workflows/orchestrator.yml.
 *
 * Required env:
 *   - GH_AUTOMATION_TOKEN (or GITHUB_TOKEN)  — Octokit auth
 *   - AI_GATEWAY_API_KEY                     — Vercel AI Gateway
 *   - FACTORY_REPO (default dmnavalon/autonomus)
 */
import 'dotenv/config';
import { runJob } from './coordinator.js';
import { commentOnIssue } from './tools/github.js';

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (command !== 'run-job') {
    console.error('Usage: autonomus run-job <issue-number>');
    process.exit(2);
  }

  const issueNumber = Number(args[0]);
  if (!Number.isFinite(issueNumber) || issueNumber <= 0) {
    console.error('issue-number must be a positive integer');
    process.exit(2);
  }

  console.log(`[autonomus] running job for issue #${issueNumber}`);

  try {
    const result = await runJob(issueNumber);
    console.log(`[autonomus] done · final_state=${result.finalState}`);
    console.log(`[autonomus] cost=$${result.ledger.totalCostUsd.toFixed(4)} input=${result.ledger.totalInput} output=${result.ledger.totalOutput}`);
    process.exit(0);
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    console.error(`[autonomus] error: ${detail}`);
    if (err instanceof Error && err.stack) console.error(err.stack);

    try {
      await commentOnIssue(
        issueNumber,
        `> ⚠️ Coordinator crashed: \`${detail.slice(0, 300)}\`. Marking as needs-human.`,
      );
    } catch {
      // best-effort
    }
    process.exit(1);
  }
}

main();
