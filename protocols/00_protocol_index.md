# Índice de protocolos — Software Factory Agent

Fuente: documento_maestro_agentes_software_factory.docx (sec. 5 + sec. 6).
Cada protocolo se crea en Fase C como archivo separado en `protocols/`.

| Archivo | Protocolo | Aplicación obligatoria |
|---|---|---|
| `01_non_condescending_communication.md` | Comunicación no condescendiente | Todos los agentes que redactan mensajes, prompts, comentarios, reportes o avisos. Tono objetivo, directo, sin halagos vacíos ni paternalismo. |
| `02_no_hallucination_evidence.md` | No alucinar y evidencia | Todos. No inventar archivos, rutas, endpoints, credenciales, estados de checks ni decisiones. Si no sabe, marcar `unknown` y pedir/buscar evidencia. |
| `03_github_first_source_of_truth.md` | GitHub como fuente de verdad | Agentes que leen/escriben prompts, protocolos, Issues, PRs, labels, artifacts y diffs. Todo cambio queda versionado. |
| `04_agent_design_handoff_guardrails.md` | Diseño de agentes y handoffs | Coordinador, Clasificador, Protocol Binder, Evaluador de Fabrica y cualquier agente que derive trabajo. |
| `05_token_efficiency_context.md` | Eficiencia de tokens | Todos. JSON corto, contexto mínimo, diffs, resúmenes, no duplicar lo que ya está en GitHub. |
| `06_security_scope_control.md` | Seguridad y control de alcance | Programador, Reparador, GitHub Operator, Arquitecto y Guard. Bloquea merge, producción, secrets, billing, borrado. |
| `07_prompt_injection_output_validation.md` | Prompt injection y validación de salidas | Agentes que leen inputs externos, archivos, logs, comentarios o instrucciones de usuario. |
| `08_ux_ui_accessibility.md` | UX/UI y accesibilidad | Agentes que crean o revisan interfaz, textos visibles, formularios, estados, responsive y navegación. |
| `09_auth_password_session.md` | Auth, password y sesiones | Cuando hay login, logout, password, recovery, roles, permisos, sesiones o MFA. |
| `10_secrets_env_vars.md` | Secrets y variables de entorno | Cuando se mencionan tokens, API keys, .env, GitHub Secrets, Vercel env vars o credenciales. |
| `11_code_quality_architecture.md` | Calidad de código y arquitectura | Arquitecto, Programador, Revisor de Código y Reparador. |
| `12_qa_playwright.md` | QA con Playwright | QA Planner, Playwright Agent, Log Analyst, Final Verifier y Reparador. |
| `13_logging_error_handling.md` | Logs y manejo de errores | Log Analyst, Reparador, Programador y Final Verifier. |
| `14_human_approval_release.md` | Aprobación humana y release | Coordinador, Final Verifier, Notificador, GitHub Operator y Guard. |
| `15_prompt_change_management.md` | Gestión de cambios de prompts | Prompt Change Manager, Protocol Binder, Coordinador y Revisor cuando se modifica un prompt/agente. |
| `16_dependency_supply_chain.md` | Dependencias y supply chain | Cuando se agregan paquetes, scripts, actions o dependencias externas. |
| `17_data_privacy.md` | Privacidad y datos | Cuando hay datos personales, documentos de usuarios, logs sensibles o contenido de clientes. |
| `18_api_integrations.md` | APIs e integraciones | Integraciones con GitHub, Vercel, Telegram, OpenAI, webhooks o APIs de clientes. |
| `19_assets_media.md` | Assets y multimedia | Cambios de imagen, video, documentos, uploads, storage y medios. |
| `20_database_migrations.md` | Base de datos y migraciones | Schema, migraciones, RLS, seed data o cambios destructivos. |

## Notas

- Todos los protocolos se citan por filename desde el frontmatter de cada agente (`required_protocols`).
- Los protocolos no contienen secrets ni valores de entorno; solo reglas operativas.
- Cualquier cambio en estos archivos pasa por el Prompt Change Manager (`19_prompt_change_manager`) con evals.
