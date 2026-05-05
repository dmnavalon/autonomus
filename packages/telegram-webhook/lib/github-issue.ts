/**
 * Creates a Job Issue in the factory repo (dmnavalon/autonomus) labelled
 * state:received + source:telegram. The orchestrator workflow picks it up.
 */
import { Octokit } from '@octokit/rest';

const FACTORY_REPO_FULL = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';
const [FACTORY_OWNER, FACTORY_REPO_NAME] = FACTORY_REPO_FULL.split('/') as [string, string];

let octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokit) {
    const token = process.env.GH_AUTOMATION_TOKEN;
    if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
    octokit = new Octokit({ auth: token, userAgent: 'autonomus-webhook' });
  }
  return octokit;
}

export interface JobIssueInput {
  message: string;
  chatId: number;
  username: string | undefined;
  hint?: string;
}

export interface JobIssueResult {
  number: number;
  url: string;
}

export async function createJobIssue(input: JobIssueInput): Promise<JobIssueResult> {
  const title = input.message.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Job sin título';
  const body = [
    '<!-- Created by Autonomus Telegram webhook. Do NOT edit by hand; comments below are written by agents. -->',
    '',
    '## Solicitud original',
    '',
    '> ' + input.message.replace(/\n/g, '\n> '),
    '',
    '## Metadata',
    '',
    `- chat_id: \`${input.chatId}\``,
    `- username: \`${input.username ?? '(none)'}\``,
    input.hint ? `- intencion_inicial_hint: \`${input.hint}\`` : '',
    `- received_at: \`${new Date().toISOString()}\``,
  ]
    .filter(Boolean)
    .join('\n');

  const { data } = await getOctokit().issues.create({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    title,
    body,
    labels: ['state:received', 'source:telegram'],
  });

  return { number: data.number, url: data.html_url };
}
