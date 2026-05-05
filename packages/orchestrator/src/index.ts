/**
 * Autonomus orchestrator — CLI entrypoint.
 *
 * Invoked from .github/workflows/orchestrator.yml as:
 *   node packages/orchestrator/dist/index.js run-job <issue-number>
 *
 * Phase 0: stub. Real coordinator wiring lands in Phase 3.
 */

const [, , command, ...args] = process.argv;

if (command === 'run-job') {
  const issueNumber = Number(args[0]);
  if (!Number.isFinite(issueNumber)) {
    console.error('Usage: autonomus-run-job <issue-number>');
    process.exit(2);
  }
  console.log(JSON.stringify({ event: 'run-job-stub', issue: issueNumber }));
  process.exit(0);
}

console.error(`Unknown command: ${command ?? '(none)'}`);
console.error('Available commands: run-job <issue-number>');
process.exit(2);
