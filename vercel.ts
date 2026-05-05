/**
 * Vercel project configuration for the telegram-webhook package.
 * See https://vercel.com/docs/project-configuration/vercel-ts
 *
 * Phase 0: minimal config; Phase 2 fills in headers and crons if needed.
 */

export const config = {
  buildCommand: 'cd packages/telegram-webhook && npm run build',
  installCommand: 'npm ci',
  framework: 'nextjs',
  rootDirectory: 'packages/telegram-webhook',
  ignoreCommand: 'git diff HEAD^ HEAD --quiet -- packages/telegram-webhook/ packages/shared/',
};

export default config;
