import { describe, it, expect } from 'vitest';
import {
  detectSecrets,
  runGithubOperator,
} from '../../packages/orchestrator/src/agents/github_operator';

describe('detectSecrets', () => {
  it('flags AWS access keys', () => {
    const hits = detectSecrets({ 'env.ts': 'const k = "AKIAIOSFODNN7EXAMPLE";' });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('flags GitHub tokens', () => {
    const hits = detectSecrets({ 'config.ts': 'token=ghp_' + 'a'.repeat(40) });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('flags OpenAI / Anthropic style', () => {
    const hits = detectSecrets({ 'lib.ts': 'sk-' + 'a'.repeat(45) });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('flags Slack tokens', () => {
    const hits = detectSecrets({ 'slack.ts': 'xoxb-12345-67890-abcdefghi' });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('flags PEM keys', () => {
    const hits = detectSecrets({ 'key.pem': '-----BEGIN PRIVATE KEY-----' });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('passes clean code', () => {
    const hits = detectSecrets({ 'app.ts': 'export default function App(){return null}' });
    expect(hits).toHaveLength(0);
  });

  it('handles empty payload', () => {
    expect(detectSecrets(undefined)).toEqual([]);
    expect(detectSecrets({})).toEqual([]);
  });
});

describe('runGithubOperator preflight', () => {
  it('blocks merge_to_main', () => {
    const r = runGithubOperator({ operation_request: 'merge_to_main', target_repo: 'x/y' });
    expect(r.output.operation_status).toBe('blocked');
    expect(r.output.errors.some((e) => e.includes('forbidden_operation'))).toBe(true);
  });

  it('blocks deploy_production', () => {
    const r = runGithubOperator({ operation_request: 'deploy_production', target_repo: 'x/y' });
    expect(r.output.operation_status).toBe('blocked');
  });

  it('blocks writes to main branch (except pr.create)', () => {
    const r = runGithubOperator({
      operation_request: 'commit.create',
      target_repo: 'x/y',
      branch_name: 'main',
    });
    expect(r.output.operation_status).toBe('blocked');
    expect(r.output.errors).toContain('write_to_main_branch_blocked');
  });

  it('allows pr.create on main as base', () => {
    const r = runGithubOperator({
      operation_request: 'pr.create',
      target_repo: 'x/y',
      branch_name: 'main',
    });
    expect(r.output.operation_status).toBe('ok');
  });

  it('blocks if files_payload contains a secret', () => {
    const r = runGithubOperator({
      operation_request: 'commit.create',
      target_repo: 'x/y',
      branch_name: 'factory/1',
      files_payload: { 'leak.ts': 'AKIAIOSFODNN7EXAMPLE' },
    });
    expect(r.output.operation_status).toBe('blocked');
  });

  it('returns ok when nothing is wrong', () => {
    const r = runGithubOperator({
      operation_request: 'commit.create',
      target_repo: 'x/y',
      branch_name: 'factory/42',
      files_payload: { 'app/page.tsx': 'export default function Page(){}' },
      commit_message: '[factory] add page',
    });
    expect(r.output.operation_status).toBe('ok');
    expect(r.output.errors).toHaveLength(0);
  });
});
