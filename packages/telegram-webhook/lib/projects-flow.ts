/**
 * Conversational project flow: welcome screen + 2 wizards (create-project,
 * link-repo). Pure orchestration over the lib/* primitives.
 *
 * Each handler returns a side-effect description (`messages` to send) plus the
 * next wizard state to persist (`nextState` or `clearWizard`). The webhook
 * route applies them.
 */
import {
  buildAppTypeKeyboard,
  buildConfirmCreateKeyboard,
  buildGithubReposKeyboard,
  buildWelcomeKeyboard,
  REPOS_PER_PAGE,
  APP_TYPE_LABELS,
  type AppTypeCode,
  type InlineKeyboardMarkup,
  type ParsedCallback,
} from './inline-keyboard';
import {
  clearWizard,
  setWizard,
  type WizardState,
  type WizardStep,
} from './conversation-state';
import {
  __resetRegistryCache,
  getLinkedApps,
  type RegistryApp,
} from './registry';
import { listLinkableRepos, type RepoCandidate } from './github-repos';
import { openCreateProjectPR, openLinkAppPR } from './github-issue';
import { nameToSlug } from './slug-generator';
import { withHeader } from './telegram';

export interface FlowMessage {
  text: string;
  /** Header slug. null = no active project. */
  headerSlug: string | null;
  replyMarkup?: InlineKeyboardMarkup;
  /** When true, asks Telegram to force the user's next message to reply to this. */
  forceReply?: boolean;
}

export interface FlowResult {
  messages: FlowMessage[];
  /** Optional sticky to set after this step. */
  setSticky?: string;
}

// ---------------------------------------------------------------------------
// welcome (entry to the project menu)
// ---------------------------------------------------------------------------

export async function welcomeMessage(
  chatId: number,
  pendingIssueNumber: number,
): Promise<FlowResult> {
  const apps = await getLinkedApps(chatId);
  const lines: string[] = [];
  if (apps.length === 0) {
    lines.push('No tienes proyectos vinculados todavía. ¿Qué quieres hacer?');
  } else {
    lines.push('¿Sobre qué proyecto quieres trabajar?');
    lines.push('');
    lines.push('Si ya tienes proyectos, elige uno de la lista. Si no, puedes crear uno o vincular un repo de GitHub.');
  }
  return {
    messages: [
      {
        text: withHeader(null, lines.join('\n')),
        headerSlug: null,
        replyMarkup: buildWelcomeKeyboard(apps, pendingIssueNumber),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// create-project wizard
// ---------------------------------------------------------------------------

export async function startCreateWizard(chatId: number): Promise<FlowResult> {
  await setWizard({
    chat_id: chatId,
    wizard: 'create-project',
    step: 'name',
    draft: {},
    started_at: new Date().toISOString(),
  });
  return {
    messages: [
      {
        text: withHeader(null, '*Paso 1 de 4* — ¿Cómo quieres llamar a tu proyecto?'),
        headerSlug: null,
        forceReply: true,
      },
    ],
  };
}

export async function continueCreateName(
  state: WizardState,
  text: string,
): Promise<FlowResult> {
  const name = text.trim();
  if (!name) {
    return {
      messages: [
        { text: withHeader(null, 'El nombre no puede estar vacío. Probá de nuevo.'), headerSlug: null, forceReply: true },
      ],
    };
  }
  await setWizard({
    chat_id: state.chat_id,
    wizard: 'create-project',
    step: 'description',
    draft: { ...state.draft, name },
    started_at: state.started_at,
  });
  return {
    messages: [
      {
        text: withHeader(
          null,
          '*Paso 2 de 4* — ¿Una descripción corta? (opcional, escribe `skip` para saltar)',
        ),
        headerSlug: null,
        forceReply: true,
      },
    ],
  };
}

export async function continueCreateDescription(
  state: WizardState,
  text: string,
): Promise<FlowResult> {
  const trimmed = text.trim();
  const description = trimmed.toLowerCase() === 'skip' ? undefined : trimmed.slice(0, 200);
  await setWizard({
    chat_id: state.chat_id,
    wizard: 'create-project',
    step: 'type',
    draft: { ...state.draft, description },
    started_at: state.started_at,
  });
  return {
    messages: [
      {
        text: withHeader(null, '*Paso 3 de 4* — ¿Qué tipo de app es?'),
        headerSlug: null,
        replyMarkup: buildAppTypeKeyboard(),
      },
    ],
  };
}

export async function continueCreateType(
  state: WizardState,
  type: AppTypeCode,
): Promise<FlowResult> {
  const apps = await getLinkedApps(state.chat_id);
  const existing = new Set(apps.map((a) => a.slug));
  const slug = nameToSlug(state.draft.name ?? 'proyecto', existing);
  await setWizard({
    chat_id: state.chat_id,
    wizard: 'create-project',
    step: 'confirm',
    draft: { ...state.draft, type, slug },
    started_at: state.started_at,
  });

  const summary = [
    '*Paso 4 de 4* — ¿Confirmas?',
    '',
    `*Nombre:* ${state.draft.name}`,
    state.draft.description ? `*Descripción:* ${state.draft.description}` : null,
    `*Tipo:* ${APP_TYPE_LABELS[type]}`,
    `*Slug interno:* \`${slug}\``,
    `*Repo destino:* \`dmnavalon/${slug}\` (privado, nuevo)`,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');

  return {
    messages: [
      {
        text: withHeader(null, summary),
        headerSlug: null,
        replyMarkup: buildConfirmCreateKeyboard(),
      },
    ],
  };
}

export async function executeCreateConfirm(
  state: WizardState,
  username: string | undefined,
): Promise<FlowResult> {
  if (!state.draft.name || !state.draft.type || !state.draft.slug) {
    await clearWizard(state.chat_id);
    return {
      messages: [
        { text: withHeader(null, 'Wizard incompleto. Empezá de nuevo desde el menú.'), headerSlug: null },
      ],
    };
  }
  try {
    const result = await openCreateProjectPR({
      slug: state.draft.slug,
      label: state.draft.name,
      description: state.draft.description,
      type: state.draft.type,
      ownerChatId: state.chat_id,
      username,
    });
    await clearWizard(state.chat_id);
    if (result.pr.merged) __resetRegistryCache();
    const mergeLine = result.pr.merged
      ? '✅ Linkeo activado (PR auto-mergeado). Ya puedes pedirme cosas sobre este proyecto.'
      : `⚠️ El PR no se auto-mergeó (${result.pr.mergeError ?? 'desconocido'}). Mergéalo a mano para activar el linkeo.`;
    return {
      messages: [
        {
          text: withHeader(
            state.draft.slug,
            [
              `✅ Proyecto creado.`,
              '',
              `Repo: ${result.repoUrl}`,
              `PR de registro: [#${result.pr.number}](${result.pr.url})`,
              '',
              mergeLine,
            ].join('\n'),
          ),
          headerSlug: state.draft.slug,
        },
      ],
      setSticky: state.draft.slug,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    await clearWizard(state.chat_id);
    return {
      messages: [
        {
          text: withHeader(null, `No pude crear el proyecto: ${detail.slice(0, 200)}`),
          headerSlug: null,
        },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// link-repo wizard
// ---------------------------------------------------------------------------

export async function startLinkWizard(chatId: number): Promise<FlowResult> {
  let candidates: RepoCandidate[];
  try {
    candidates = await listLinkableRepos();
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return {
      messages: [
        {
          text: withHeader(null, `No pude listar tus repos de GitHub: ${detail.slice(0, 150)}`),
          headerSlug: null,
        },
      ],
    };
  }
  if (candidates.length === 0) {
    return {
      messages: [
        {
          text: withHeader(
            null,
            'Todos tus repos de GitHub ya están linkeados (o no tienes ninguno disponible).\n\n*Modo manual:* `/link <slug> <usuario/repo>`',
          ),
          headerSlug: null,
        },
      ],
    };
  }

  await setWizard({
    chat_id: chatId,
    wizard: 'link-repo',
    step: 'pick-gh',
    draft: {
      candidates: candidates.map((c) => ({ owner: c.owner, name: c.name })),
      page: 0,
    },
    started_at: new Date().toISOString(),
  });

  return {
    messages: [
      {
        text: withHeader(
          null,
          [
            '*Vincular repo de GitHub*',
            '',
            `Tienes ${candidates.length} repo${candidates.length > 1 ? 's' : ''} disponibles. Elige uno:`,
          ].join('\n'),
        ),
        headerSlug: null,
        replyMarkup: buildGithubReposKeyboard(candidates, 0),
      },
    ],
  };
}

export async function continueLinkPickGh(
  state: WizardState,
  index: number,
): Promise<FlowResult> {
  const candidates = state.draft.candidates ?? [];
  const picked = candidates[index];
  if (!picked) {
    return {
      messages: [
        { text: withHeader(null, 'Selección inválida. Empezá de nuevo desde el menú.'), headerSlug: null },
      ],
    };
  }
  await setWizard({
    chat_id: state.chat_id,
    wizard: 'link-repo',
    step: 'label',
    draft: { ...state.draft, repo: `${picked.owner}/${picked.name}` },
    started_at: state.started_at,
  });
  return {
    messages: [
      {
        text: withHeader(
          null,
          `*Repo elegido:* \`${picked.owner}/${picked.name}\`\n\n¿Cómo quieres llamar a este proyecto en el bot?\n(opcional, escribe \`skip\` para usar \`${picked.name}\`)`,
        ),
        headerSlug: null,
        forceReply: true,
      },
    ],
  };
}

export async function continueLinkPage(
  state: WizardState,
  page: number,
): Promise<FlowResult> {
  const candidates = (state.draft.candidates ?? []).map((c) => ({
    owner: c.owner,
    name: c.name,
    full_name: `${c.owner}/${c.name}`,
    description: null,
    pushed_at: '',
    private: false,
  }));
  await setWizard({
    chat_id: state.chat_id,
    wizard: 'link-repo',
    step: 'pick-gh',
    draft: { ...state.draft, page },
    started_at: state.started_at,
  });
  const start = page * REPOS_PER_PAGE;
  return {
    messages: [
      {
        text: withHeader(null, `*Repos disponibles* (página ${page + 1}, ${start + 1}–${Math.min(start + REPOS_PER_PAGE, candidates.length)} de ${candidates.length})`),
        headerSlug: null,
        replyMarkup: buildGithubReposKeyboard(candidates, page),
      },
    ],
  };
}

export async function executeLinkLabel(
  state: WizardState,
  text: string,
  username: string | undefined,
): Promise<FlowResult> {
  if (!state.draft.repo) {
    await clearWizard(state.chat_id);
    return {
      messages: [
        { text: withHeader(null, 'Wizard incompleto. Empezá de nuevo.'), headerSlug: null },
      ],
    };
  }
  const trimmed = text.trim();
  const repoName = state.draft.repo.split('/').pop() ?? 'proyecto';
  const label = !trimmed || trimmed.toLowerCase() === 'skip'
    ? repoName
    : trimmed.slice(0, 60);

  // Use the repo name as slug seed (GitHub names are mostly already kebab-case lowercase).
  const apps = await getLinkedApps(state.chat_id);
  const existing = new Set(apps.map((a) => a.slug));
  const slug = nameToSlug(repoName, existing);

  try {
    const pr = await openLinkAppPR({
      slug,
      label,
      repo: state.draft.repo,
      ownerChatId: state.chat_id,
      username,
    });
    await clearWizard(state.chat_id);
    if (pr.merged) __resetRegistryCache();
    const mergeLine = pr.merged
      ? '✅ Linkeo activado (PR auto-mergeado). Ya puedes pedirme cosas sobre este proyecto.'
      : `⚠️ El PR no se auto-mergeó (${pr.mergeError ?? 'desconocido'}). Mergéalo a mano para activar el linkeo.`;
    return {
      messages: [
        {
          text: withHeader(
            slug,
            [
              `✅ Vinculado \`${state.draft.repo}\` como *${label}*.`,
              '',
              `PR de registro: [#${pr.number}](${pr.url})`,
              '',
              mergeLine,
            ].join('\n'),
          ),
          headerSlug: slug,
        },
      ],
      setSticky: slug,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    await clearWizard(state.chat_id);
    return {
      messages: [
        { text: withHeader(null, `No pude abrir el PR: ${detail.slice(0, 200)}`), headerSlug: null },
      ],
    };
  }
}

// ---------------------------------------------------------------------------
// dispatch from webhook route
// ---------------------------------------------------------------------------

/** True if this incoming text is the user's reply to a wizard-step prompt. */
export function isWizardTextStep(state: WizardState): boolean {
  return (
    (state.wizard === 'create-project' &&
      (state.step === 'name' || state.step === 'description')) ||
    (state.wizard === 'link-repo' && state.step === 'label')
  );
}

export async function continueWizardOnText(
  state: WizardState,
  text: string,
  username: string | undefined,
): Promise<FlowResult> {
  if (state.wizard === 'create-project') {
    if (state.step === 'name') return continueCreateName(state, text);
    if (state.step === 'description') return continueCreateDescription(state, text);
  }
  if (state.wizard === 'link-repo' && state.step === 'label') {
    return executeLinkLabel(state, text, username);
  }
  // Unrecognized step → cancel
  await clearWizard(state.chat_id);
  return {
    messages: [
      { text: withHeader(null, 'Wizard cancelado.'), headerSlug: null },
    ],
  };
}

export async function continueWizardOnCallback(
  state: WizardState,
  callback: ParsedCallback,
  username: string | undefined,
): Promise<FlowResult> {
  if (callback.kind === 'cancel-wizard') {
    await clearWizard(state.chat_id);
    return { messages: [{ text: withHeader(null, 'Wizard cancelado.'), headerSlug: null }] };
  }
  if (state.wizard === 'create-project' && state.step === 'type' && callback.kind === 'apptype') {
    return continueCreateType(state, callback.type);
  }
  if (state.wizard === 'create-project' && state.step === 'confirm' && callback.kind === 'confirm-create') {
    return executeCreateConfirm(state, username);
  }
  if (state.wizard === 'link-repo' && state.step === 'pick-gh') {
    if (callback.kind === 'pick-gh') return continueLinkPickGh(state, callback.index);
    if (callback.kind === 'gh-page') return continueLinkPage(state, callback.page);
  }
  // Out-of-step callback → ignore and re-prompt last step
  return { messages: [] };
}

/** Used by /apps and /current to display the user-friendly name. */
export function appDisplayName(app: RegistryApp): string {
  return app.label && app.label.length > 0 ? app.label : app.slug;
}

export type { WizardStep };
