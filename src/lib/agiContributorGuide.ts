// PHANTIX AGI Contributor Guide â€” bundled so it is ONLY rendered inside the
// agi-admin gated AGI Management dashboard (never exposed as a public asset).
// Source: backend docs/PHANTIX_AGI_CONTRIBUTOR_GUIDE.md
export const AGI_CONTRIBUTOR_GUIDE_MD = `# PHANTIX AGI — Contributor Guide

**Audience:** Backend, runner, frontend, and ops engineers extending the Phantix Autonomous Agent
**Status:** Product capability (management plane + separate runner)
**Last aligned with codebase:** AGI runner v0.3+, migrations through \`i5d6e7f8a9b0\`

This document is the **single technical source of truth** for contributors. Product/ops overviews live elsewhere; this guide tells you **what exists, where it lives, how to change it safely, and how to verify**.

---

## Table of contents

1. [What the Autonomous Agent is (and is not)](#1-what-the-autonomous-agent-is-and-is-not)
2. [Architecture](#2-architecture)
3. [Repository map](#3-repository-map)
4. [Security model (non-negotiable)](#4-security-model-non-negotiable)
5. [Data model & migrations](#5-data-model--migrations)
6. [Backend management plane](#6-backend-management-plane)
7. [Runner service](#7-runner-service)
8. [Tools, shell, auth, registration](#8-tools-shell-auth-registration)
9. [Skills & training](#9-skills--training)
10. [Preflight & info requests](#10-preflight--info-requests)
11. [Autonomy & asset planning](#11-autonomy--asset-planning)
12. [Findings & reports](#12-findings--reports)
13. [Tool install admin queue](#13-tool-install-admin-queue)
14. [API catalog](#14-api-catalog)
15. [Environment variables](#15-environment-variables)
16. [Local development](#16-local-development)
17. [Staging / production deploy](#17-staging--production-deploy)
18. [Testing](#18-testing)
19. [How to extend AGI](#19-how-to-extend-agi)
20. [Frontend integration notes](#20-frontend-integration-notes)
21. [Operational runbooks](#21-operational-runbooks)
22. [Related docs](#22-related-docs)

---

## 1. What the Autonomous Agent is (and is not)

### Is

- A **human-gated, organization-scoped security-engineering agent**
- Separated into:
  - **Management plane** (Phantix Backend): auth, engagements, approvals, skills, findings, reports
  - **Runner** (\`services/phantix-agi\`): ephemeral containers, DeepSeek loop, tools, shell
- Medium-autonomy recon over **Asset Engine** inventory
- Login + **test-user registration**, OTP wait, container shell + background jobs
- Skill-driven (trainable library + seed skills + auto-mint)
- Evidence-backed findings and **Reporting Engine** handoff tagged \`phantix_agi\`

### Is not

- OpenCode / OpenClaw / generic coding agent
- A RAG system (no vector index for AGI)
- Fully autonomous exploitation
- Allowed to touch **host** shell, **other orgs**, or **platform databases** directly

### LLM provider

- **DeepSeek only** for AGI reasoning (\`DEEPSEEK_API_KEY\` on the runner)
- Do not add multi-provider routing to AGI without product review

---

## 2. Architecture

\`\`\`text
┌──────────────────────────────────────────────────────────────────────┐
│  Staff portal / Platform / App FE                                     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ JWT (staff or org)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Phantix Backend (management plane)                                   │
│  /api/v1/admin/agi/*   staff + agi_admin                             │
│  /api/v1/agi/*         customer (entitlement + agreement + org on)   │
│                                                                        │
│  • engagements / sessions / actions / transcripts                      │
│  • skills, preflight, credentials, registration, info requests         │
│  • engine_data → Asset Engine (org-scoped)                             │
│  • findings_promotion → session.meta + optional risk                  │
│  • report_handoff → Reporting Engine (source=phantix_agi)              │
│  • dual_control for customer state-changing                            │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ PHANTIX_AGI_SERVICE_TOKEN
                                │ HTTP + SSE
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PHANTIX AGI Runner  (:8095)                                          │
│  services/phantix-agi                                                 │
│  • provision ephemeral Docker sandbox per session                      │
│  • DeepSeek chat/stream                                               │
│  • scope_guard + prompt_guard                                         │
│  • tools_exec / shell_jobs / auth_tools (container-only)               │
│  • callbacks: propose-action, findings, tool-install, info-request     │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ docker exec only
                                ▼
                    Engagement sandbox container
                    (phantix-agi-sandbox:latest)
\`\`\`

### Network topology (Coolify / Docker)

| From | To | Address |
|------|-----|---------|
| API container | Runner | \`http://phantix-agi:8095\` (**not** \`127.0.0.1\`) |
| Runner | API | \`http://api:8000\` (same compose network) |
| Host | Runner health | \`http://127.0.0.1:8095/health\` |
| Sandbox | Targets | \`bridge\` (or \`PHANTIX_AGI_CONTAINER_NETWORK\`) |

---

## 3. Repository map

### Backend (management plane)

| Path | Role |
|------|------|
| \`app/engines/ai_engine/agi/models.py\` | SQLAlchemy: engagements, sessions, actions, transcripts, skills, tool installs |
| \`app/engines/ai_engine/agi/policy_models.py\` | Usage policies, org agreement, org settings |
| \`app/engines/ai_engine/agi/schemas.py\` | Pydantic request/response bodies |
| \`app/engines/ai_engine/agi/service.py\` | Session lifecycle, chat gates, decide, info provide |
| \`app/engines/ai_engine/agi/customer_api.py\` | Customer \`/api/v1/agi/*\` |
| \`app/engines/ai_engine/agi/customer_service.py\` | Agreement, org settings, access snapshot, intent |
| \`app/engines/ai_engine/agi/runner_client.py\` | HTTP client to runner |
| \`app/engines/ai_engine/agi/engine_data.py\` | Asset Engine inventory + allowlist expand |
| \`app/engines/ai_engine/agi/autonomy.py\` | Autonomy levels + per-asset plan |
| \`app/engines/ai_engine/agi/preflight.py\` | Skill readiness / missing-info checks |
| \`app/engines/ai_engine/agi/prompt_guard.py\` | Forbidden prompt patterns (backend) |
| \`app/engines/ai_engine/agi/dual_control.py\` | Two-person approval pure logic |
| \`app/engines/ai_engine/agi/skill_schema.py\` | Skill document schema + **SEED_SKILLS** |
| \`app/engines/ai_engine/agi/skill_training.py\` | Rank, reinforce, auto-mint, seed insert |
| \`app/engines/ai_engine/agi/findings_promotion.py\` | Session findings + risk promote |
| \`app/engines/ai_engine/agi/report_handoff.py\` | Report to Reporting Engine |
| \`app/engines/ai_engine/agi/tool_install.py\` | Session install + admin provision queue |
| \`app/engines/control_plane/api/admin/admin_agi.py\` | Staff + internal routes |
| \`app/core/staff_dependencies.py\` | \`require_agi_admin\` |
| \`app/engines/control_plane/services/entitlements_service.py\` | \`assert_agi_access\` |

### Runner

| Path | Role |
|------|------|
| \`services/phantix-agi/main.py\` | FastAPI runner app |
| \`services/phantix-agi/scope_guard.py\` | Allowlist / forbidden action enforcement |
| \`services/phantix-agi/prompt_guard.py\` | Forbidden prompts (keep in sync with backend) |
| \`services/phantix-agi/tools_exec.py\` | Tool dispatch (container-only) |
| \`services/phantix-agi/shell_jobs.py\` | Shell + background jobs + OTP inbox |
| \`services/phantix-agi/auth_tools.py\` | Login + register form helpers |
| \`services/phantix-agi/tool_parse.py\` | Parse model tool/info/finding lines |
| \`services/phantix-agi/forbidden.md\` | Authoritative forbidden policy |
| \`services/phantix-agi/SECURITY_POLICY.md\` | Runtime security policy |
| \`services/phantix-agi/sandbox/\` | Ephemeral engagement image |
| \`services/phantix-agi/docker-compose.agi.yml\` | Lab compose |
| \`services/phantix-agi/Dockerfile\` | Runner image |

### Migrations

| Revision | Purpose |
|----------|---------|
| \`f2a3b4c5d6e7\` | Core AGI tables + \`platform_staff.agi_admin\` |
| \`g3b4c5d6e7f8\` | Skills + skill outcomes |
| \`h4c5d6e7f8a9\` | Usage policies, agreement acceptances, org settings |
| \`i5d6e7f8a9b0\` | Tool install request queue |

### Scripts & tests

| Path | Role |
|------|------|
| \`scripts/agi_local_up.sh\` | Local runner |
| \`scripts/agi_smoke_offline.py\` | Offline smoke (scope, parse, dual, skills) |
| \`tests/test_agi_skill_schema.py\` | Skill schema |
| \`tests/test_agi_scope_and_dual.py\` | Scope, dual control, preflight, autonomy |

---

## 4. Security model (non-negotiable)

### Isolation layers

1. **Prompt guard** — host info, cross-org, direct DB, host terminal (any phrasing)
2. **Scope guard** — every tool command checked against \`target_allowlist\` + \`forbidden_actions\`
3. **Container-only execution** — no host \`nmap\`/\`getent\`/apt/shell
4. **Single org** — engagement \`organization_id\`; engine queries filtered
5. **No runner DB** — runner never opens Postgres; Backend injects context
6. **Human gates** — state-changing, auth login/register, package install
7. **Secrets hygiene** — passwords/OTP not written into transcripts

### Forbidden categories (see \`services/phantix-agi/forbidden.md\`)

- Host / platform server information
- Other Phantix organizations / tenants
- Direct SQL / DB dumps / connection strings
- Host terminal / breakout
- Out-of-scope targets

### When adding features

| Do | Don't |
|----|--------|
| Filter by \`organization_id\` via engines | Query all orgs or raw multi-tenant SQL from runner |
| Run tools via \`docker exec\` into engagement container | Run tools on runner host |
| Gate state-changing with approve flow | Auto-run exploits or registration without approval |
| Use \`prompt_guard\` on chat/start/shell | Rely only on system prompt |
| Redact passwords in APIs/transcripts | Log credentials |

**Keep backend and runner \`prompt_guard.py\` patterns in sync.**

---

## 5. Data model & migrations

### Core tables

| Table | Purpose |
|-------|---------|
| \`agi_engagements\` | Immutable scope + config + status |
| \`agi_sessions\` | One container run; \`meta\` holds preflight, plan, credentials view |
| \`agi_actions\` | Read / state_changing proposals and decisions |
| \`agi_transcripts\` | Append-only history (\`seq\`) |
| \`agi_skills\` / \`agi_skill_outcomes\` | Trainable skill library |
| \`agi_tool_install_requests\` | Session install → admin server-wide queue |
| \`agi_usage_policies\` | Versioned customer agreement |
| \`agi_org_agreement_acceptances\` | Per-org accept of active version |
| \`agi_org_settings\` | Customer enable + limits + dual control |

### Session \`meta\` keys (important)

| Key | Meaning |
|-----|---------|
| \`autonomy\` | \`low\` \\| \`medium\` \\| \`high\` |
| \`assets_loaded\` | Count from Asset Engine |
| \`asset_plan_preview\` | First N plan items |
| \`preflight\` | \`{ ready, missing, info_requests, message }\` |
| \`provided_info\` | Operator-supplied preflight fields |
| \`credentials\` | Public view only (\`password_set\`, no secret) |
| \`registration\` | Public view of signup config |
| \`report\` | After stop: Reporting Engine ids |

### Apply migrations

\`\`\`bash
# local / container
alembic upgrade head
# expect head including i5d6e7f8a9b0
\`\`\`

---

## 6. Backend management plane

### Access control

| Surface | Auth | Gate |
|---------|------|------|
| Staff AGI | Staff JWT | Superadmin **or** \`agi_admin=true\` |
| Grant AGI | Superadmin | \`POST /admin/agi/grants\` |
| Customer AGI | Org/app JWT | \`PHANTIX_AGI_ENABLED\` + \`assert_agi_access\` + org enabled + agreement |

### Session start flow (\`service.start_session\`)

1. Validate engagement status; end previous running sessions
2. **Prompt guard** on instruction
3. Select skills by scope efficiency (\`skill_training\`)
4. Load **org assets** via Asset Engine (\`engine_data\`)
5. Expand allowlist; build **asset_plan** (\`autonomy.plan_for_assets\`)
6. Attach credentials (optional); run **preflight** for mobile/registration skills
7. Call runner \`POST /v1/sessions\` with scope + config
8. Persist session; transcript includes preflight / INFO_REQUEST if blocked

### Action decision (\`service.decide_action\`)

- Statuses: \`pending_approval\` → (\`pending_second_approval\`) → \`executed\` | \`rejected\`
- Customer dual control: \`require_dual_control_for_active\` + different approver
- Staff default: \`force_single=true\` on decide endpoint

### Entitlement

\`assert_agi_access\` accepts Premium or packs: \`phantix_agi\`, \`ai_pentest_agent\`, \`ai_assist\`.

---

## 7. Runner service

### Responsibilities

- Ephemeral container lifecycle (\`phantix-agi-sandbox:latest\`)
- DeepSeek streaming + tool parsing
- Execute in-scope tools **inside container**
- Background shell jobs + OTP inbox file
- Callbacks to Backend with service token

### Session in-memory model (\`LiveSession\`)

Not durable across runner restarts. Durable state is Backend DB + transcripts.
If runner restarts mid-session, operator must stop/start a new session.

### Container defaults

| Setting | Value |
|---------|--------|
| Memory / CPU | 1g / 1 CPU |
| Security | \`no-new-privileges\` |
| Network | \`bridge\` (or \`PHANTIX_AGI_CONTAINER_NETWORK\`) |
| Mounts | scope JSON read-only under \`/sandbox/scope\` |
| Work dirs | \`/sandbox/work\`, \`/sandbox/out\` |

### Health

\`\`\`bash
curl -sS http://127.0.0.1:8095/health
# docker, deepseek_configured, features[], sessions
\`\`\`

### Model tool protocol

The model should emit structured directives (parsed by \`tool_parse.py\`):

\`\`\`text
\`\`\`agi-tool
{"tool":"http_get","args":["https://in-scope.example"],"action_class":"read"}
\`\`\`

TOOL shell nmap -Pn target.example
TOOL auth_login
TOOL auth_register
TOOL wait_otp
REQUEST_TOOL: nikto | nikto | web scanner
REQUEST_INFO: package_name | Android package id
PROPOSE_STATE: <cmd> | <why>
FINDING: title | medium | evidence...
\`\`\`

---

## 8. Tools, shell, auth, registration

### Built-in tools

| Tool | Class | Notes |
|------|-------|--------|
| \`http_get\` | read | Container or lab network proxy |
| \`dns_lookup\` | read | Container |
| \`nmap_top\` | read | Container |
| \`shell\` | read* | Container only; destructive markers gated |
| \`bg_shell\` | read/bg | Background process + log |
| \`wait_otp\` | wait | BG job; operator \`POST .../otp\` |
| \`auth_login\` | state_changing | Gated; needs credentials |
| \`auth_register\` | state_changing | Gated; test user only |
| \`install_package\` | state_changing | apt in container only → admin queue |

\\*Medium autonomy may auto-run recon shell; host shell is never available.

### Credentials (login)

\`\`\`http
POST /api/v1/admin/agi/sessions/{id}/credentials
{ "login_url": "...", "username": "...", "password": "..." }
\`\`\`

### Test registration

\`\`\`http
POST /api/v1/admin/agi/sessions/{id}/registration
{
  "register_url": "https://app.example/signup",
  "email": "test+agi@example.com",
  "username": "agi_tester",
  "password": "..."
}
\`\`\`

Then approve pending \`auth_register\` action.

### OTP / background wait

1. Approve login/register if \`otp_likely\` / \`verification_likely\`
2. Runner starts bg job polling \`/sandbox/work/user_input.txt\`
3. Operator: \`POST /sessions/{id}/otp\` \`{ "otp": "123456", "job_id": "..." }\`
4. Scripts/jobs continue

### Shell API

\`\`\`http
POST /api/v1/admin/agi/sessions/{id}/shell
{ "command": "id && uname -a", "background": false, "wait_otp": false }
GET /api/v1/admin/agi/sessions/{id}/jobs
\`\`\`

Shell still goes through \`prompt_guard\` (host-info patterns blocked).

---

## 9. Skills & training

### Skill document (\`AgiSkillDocument\`)

- \`skill_id\` like \`agi.mobile.dynamic-analysis\`
- \`kind\`: recon | web | api | network | **mobile** | cloud | exploit_verify | reporting | general
- \`body_md\` playbook
- \`tools[]\`, \`scope_affinity\`, \`requires_approval\`

### Seed skills (bootstrap)

Defined in \`skill_schema.SEED_SKILLS\`, inserted by \`skill_training.ensure_seed_skills\`:

| skill_id | Purpose |
|----------|---------|
| \`agi.recon.http-surface\` | HTTP surface map |
| \`agi.api.openapi-probe\` | OpenAPI discovery |
| \`agi.network.port-enum-safe\` | Light ports |
| \`agi.exploit.verify-with-approval\` | Gated verify |
| \`agi.auth.test-user-registration\` | Test user signup |
| \`agi.mobile.dynamic-analysis\` | Mobile dynamic + preflight |

### Efficiency ranking

\`scope_efficiency_boost\` × historical score → select top-N for engagement.

### Auto-mint

On session teardown (\`train_from_session_teardown\`): reinforce used skills; mint candidates if enabled in engagement config.

### Adding a skill

1. Add document to \`SEED_SKILLS\` **or** \`POST /admin/agi/skills\`
2. Validate with \`parse_skill_document\`
3. Prefer \`target_kinds\` / \`allowlist_hints\` for ranking
4. If skill needs org inputs, extend \`preflight.REQUIREMENT_CATALOGS\`
5. Add unit tests for schema/preflight

---

## 10. Preflight & info requests

### Why

Dynamic mobile (and registration-heavy flows) must not invent APKs, package names, or accounts. Preflight blocks readiness until the operator supplies missing fields.

### Mobile dynamic required keys

| Key | Meaning |
|-----|---------|
| \`mobile_binary\` | APK/IPA asset or URL |
| \`package_identifier\` | Package / bundle ID |
| \`backend_endpoints\` | API bases in scope |
| \`test_account\` | Credentials **or** registration path |
| \`platform_env\` | android\\|ios + environment |
| \`roe_consent\` | Dynamic analysis authorized |

### Operator APIs

\`\`\`http
GET  /api/v1/admin/agi/sessions/{id}/preflight
POST /api/v1/admin/agi/sessions/{id}/info
{
  "fields": {
    "package_name": "com.example.app",
    "apk_url": "https://…/app.apk",
    "api_base_url": "https://api.example.com",
    "platform": "android",
    "environment": "staging",
    "roe_confirmed": true,
    "register_url": "https://app.example/signup"
  },
  "note": "Staging build for Q3"
}
\`\`\`

### Model emission

\`\`\`text
REQUEST_INFO: package_name | Android package id com.example.app
\`\`\`

Runner emits SSE \`info_request\` and callbacks Backend internal route.

---

## 11. Autonomy & asset planning

### Levels (\`autonomy.py\`)

| Level | Behavior |
|-------|----------|
| \`low\` | Prefer gates; operator-driven |
| \`medium\` (default) | Auto recon per asset; gate auth/register/exploit |
| \`high\` | Reserved; still gates auth |

### Session start body

\`\`\`json
{
  "instruction": "Assess all org assets; prepare mobile dynamic if APK present",
  "autonomy": "medium",
  "include_org_assets": true,
  "credentials": {
    "login_url": "https://app.example/login",
    "username": "tester",
    "password": "…"
  }
}
\`\`\`

### Asset plan

For each Asset Engine asset, steps may include \`http_get\`, \`dns_lookup\`, \`nmap_top\`, and gated \`auth_login\`. Runner auto-executes \`mode=auto_execute\` steps on session start when \`PHANTIX_AGI_AUTO_RECON=true\`.

---

## 12. Findings & reports

### Findings

- Stored on \`session.meta["findings"]\` (no separate findings table)
- Require evidence text (no empty claims)
- Staff: list / status / promote to risk
- Runner heuristics from tool results + \`FINDING:\` lines

### Reports

On **session stop**, \`report_handoff.generate_agi_report\`:

- \`report_type\`: \`agi_session\`
- Title prefix: \`[Autonomous Agent]\`
- \`sections.source\` / tags: **\`phantix_agi\`**
- Org-scoped only

---

## 13. Tool install admin queue

\`\`\`text
missing tool → REQUEST_TOOL / tool_not_provisioned
  → approve install_package
  → apt inside engagement container only
  → mint skill candidate
  → status pending_admin
  → staff rebuilds phantix-agi-sandbox image
  → POST /admin/agi/tool-installs/{id}/decide { "provision": true }
\`\`\`

Never install packages on the **host**.

---

## 14. API catalog

Base paths:

- Staff: \`/api/v1/admin/agi\`
- Customer: \`/api/v1/agi\`
- Runner: \`http://<runner>:8095/v1\`

### Staff (selected)

| Method | Path | Purpose |
|--------|------|---------|
| GET | \`/status\` | Runner reachability |
| GET/POST | \`/policies\`, \`/policies/active\` | Agreement versions |
| POST/GET | \`/grants\` | agi_admin (superadmin) |
| CRUD-ish | \`/engagements\` | Scope immutable after create |
| POST | \`/engagements/{id}/sessions\` | Start (autonomy, assets, credentials) |
| POST | \`/sessions/{id}/chat\` | Operator message |
| GET | \`/sessions/{id}/transcript\` | Poll history |
| GET | \`/sessions/{id}/stream\` | SSE proxy |
| GET | \`/sessions/{id}/actions/pending\` | Approvals |
| POST | \`/actions/{id}/decide\` | Approve/reject |
| POST | \`/sessions/{id}/credentials\` | Login secrets |
| POST | \`/sessions/{id}/registration\` | Test signup config |
| POST | \`/sessions/{id}/info\` | Preflight answers |
| GET | \`/sessions/{id}/preflight\` | Missing info |
| POST | \`/sessions/{id}/otp\` | MFA code |
| POST | \`/sessions/{id}/shell\` | Container shell |
| GET | \`/sessions/{id}/jobs\` | BG jobs |
| GET/POST | \`/sessions/{id}/findings…\` | Findings |
| GET/POST | \`/skills…\` | Skill library |
| GET | \`/tool-installs\` | Admin provision queue |
| POST | \`/sessions/{id}/stop\` | Teardown + train + report |

### Internal (service token only)

| Path | Purpose |
|------|---------|
| \`/internal/sessions/{id}/propose-action\` | Runner proposed actions |
| \`/internal/sessions/{id}/findings\` | Runner findings |
| \`/internal/sessions/{id}/tool-install\` | Install request |
| \`/internal/sessions/{id}/tool-install/complete\` | Installed in session |
| \`/internal/sessions/{id}/info-request\` | REQUEST_INFO from model |

### Customer (high level)

Access snapshot, agreement accept, intent recommend, org settings, org-scoped engagements/sessions/actions. Dual control applies when org setting requires it.

### Runner

| Method | Path |
|--------|------|
| GET | \`/health\` |
| POST | \`/v1/sessions\` |
| POST | \`/v1/sessions/{rsid}/chat\` |
| POST | \`/v1/sessions/{rsid}/actions/{id}/decide\` |
| POST | \`/v1/sessions/{rsid}/credentials\` |
| POST | \`/v1/sessions/{rsid}/registration\` |
| POST | \`/v1/sessions/{rsid}/info\` |
| POST | \`/v1/sessions/{rsid}/otp\` |
| POST | \`/v1/sessions/{rsid}/shell\` |
| GET | \`/v1/sessions/{rsid}/jobs\` |
| GET | \`/v1/sessions/{rsid}/stream\` |
| POST | \`/v1/sessions/{rsid}/teardown\` |

---

## 15. Environment variables

### Backend

| Variable | Purpose |
|----------|---------|
| \`PHANTIX_AGI_ENABLED\` | Master switch |
| \`PHANTIX_AGI_SERVICE_URL\` | Runner URL (**use service DNS in Docker**, e.g. \`http://phantix-agi:8095\`) |
| \`PHANTIX_AGI_SERVICE_TOKEN\` | Shared secret (same on runner) |
| \`PHANTIX_AGI_DEEPSEEK_ONLY\` | Product flag |
| \`PHANTIX_AGI_DEFAULT_IMAGE\` | Sandbox image name |
| \`PHANTIX_AGI_MAX_SESSION_MINUTES\` | Cap |

### Runner

| Variable | Purpose |
|----------|---------|
| \`PHANTIX_AGI_SERVICE_TOKEN\` | Must match Backend |
| \`DEEPSEEK_API_KEY\` | Required for real model |
| \`DEEPSEEK_API_BASE\` | Default \`https://api.deepseek.com\` |
| \`DEEPSEEK_MODEL\` | e.g. \`deepseek-chat\` |
| \`PHANTIX_BACKEND_URL\` | e.g. \`http://api:8000\` |
| \`PHANTIX_AGI_DEFAULT_IMAGE\` | Sandbox tag |
| \`PHANTIX_AGI_AUTO_RECON\` | \`true\`/\`false\` asset plan auto-exec |
| \`PHANTIX_AGI_CONTAINER_NETWORK\` | Default \`bridge\` |
| \`AGI_HOST\` / \`AGI_PORT\` | Bind (default \`0.0.0.0:8095\`) |

---

## 16. Local development

### Prerequisites

- Python 3.12+, project \`.venv\`
- Docker (for real containers)
- Postgres for Backend (normal Phantix setup)
- DeepSeek key optional (lab mock replies without it)

### Backend

\`\`\`bash
cp .env.example .env
# set DATABASE_URL, PHANTIX_AGI_*, DEEPSEEK if testing end-to-end
alembic upgrade head
uvicorn app.main:app --reload --port 8000
\`\`\`

### Runner

\`\`\`bash
./scripts/agi_local_up.sh
# or Docker:
./scripts/agi_local_up.sh --docker

export PHANTIX_AGI_SERVICE_TOKEN=dev-agi-token
export DEEPSEEK_API_KEY=...
export PHANTIX_BACKEND_URL=http://127.0.0.1:8000
cd services/phantix-agi && python main.py
\`\`\`

Build sandbox:

\`\`\`bash
docker build -t phantix-agi-sandbox:latest services/phantix-agi/sandbox
\`\`\`

### Smoke

\`\`\`bash
.venv/bin/python scripts/agi_smoke_offline.py
.venv/bin/python -m pytest tests/test_agi_skill_schema.py tests/test_agi_scope_and_dual.py -q
curl -sS http://127.0.0.1:8095/health
\`\`\`

### Pre-commit

\`\`\`bash
pre-commit run --all-files
# or scoped files you touched
\`\`\`

---

## 17. Staging / production deploy

### Backend

1. Ship image via CD (GHCR / Coolify)
2. Set AGI env vars in Coolify UI
3. \`alembic upgrade head\` (inside API container if needed)
4. Grant superadmin \`agi_admin\` if column false

### Runner (typical Contabo pattern)

\`\`\`bash
# code under /opt/phantix-agi
docker compose -f docker-compose.prod.yml up -d --build
docker build -t phantix-agi-sandbox:latest ./sandbox
systemctl enable --now phantix-agi   # if unit installed
\`\`\`

Attach runner to the **same Docker network** as the API so DNS name \`phantix-agi\` resolves.

**Critical:** \`PHANTIX_AGI_SERVICE_URL=http://phantix-agi:8095\` inside API containers — not \`127.0.0.1\`.

### Verify

\`\`\`bash
curl -sS http://127.0.0.1:8095/health
# from API container:
python -c "import httpx; print(httpx.get('http://phantix-agi:8095/health').json())"
# staff:
GET /api/v1/admin/agi/status
\`\`\`

---

## 18. Testing

| Layer | What |
|-------|------|
| Unit | \`tests/test_agi_skill_schema.py\`, \`tests/test_agi_scope_and_dual.py\` |
| Offline smoke | \`scripts/agi_smoke_offline.py\` |
| Runner smoke | provision session + chat + teardown with service token |
| Integration | Staff start session with assets; approve login/register; OTP; stop → report |

When changing guards/parsers, always add a unit test (forbidden prompts, preflight missing/ready, tool parse).

---

## 19. How to extend AGI

### Add a new read tool

1. Implement script under \`services/phantix-agi/sandbox/tools/\`
2. Map in \`tools_exec.docker_exec_tool\` / \`execute_read_tool\`
3. Scope-check inputs via \`scope_guard\`
4. Optionally parse results into findings
5. Document in this guide + FE if operator-visible
6. Prefer shipping tool in sandbox image; use install queue for optional tools

### Add a state-changing tool

1. Classify as \`state_changing\`
2. Queue pending action + Backend \`propose-action\`
3. Execute only after \`decide\` approve
4. Never log secrets

### Add a skill with preflight

1. Add \`SEED_SKILLS\` entry (or API upsert)
2. Add requirements to \`preflight.REQUIREMENT_CATALOGS[skill_id]\`
3. Instruction hints may auto-include skill in preflight evaluation
4. FE: surface \`info_requests\` when \`preflight.ready\` is false

### Add Backend API

1. Schema in \`schemas.py\`
2. Logic in \`service.py\` / dedicated module
3. Route in \`admin_agi.py\` and/or \`customer_api.py\` with correct auth
4. Runner client method if runner must know
5. Tests + FE doc

### Dual-write prompt guards

Edit **both**:

- \`app/engines/ai_engine/agi/prompt_guard.py\`
- \`services/phantix-agi/prompt_guard.py\`
- \`services/phantix-agi/forbidden.md\`

---

## 20. Frontend integration notes

Primary FE docs:

- [frontend/PHANTIX_AGI_MANAGEMENT_FE.md](./frontend/PHANTIX_AGI_MANAGEMENT_FE.md)
- [frontend/PHANTIX_AGI_THREE_PORTALS_FE.md](./frontend/PHANTIX_AGI_THREE_PORTALS_FE.md)

### Staff portal must implement

1. Grant \`agi_admin\` (superadmin)
2. Engagement create (immutable scope)
3. Session start with instruction + autonomy + optional credentials
4. SSE stream + transcript poll fallback
5. Pending action approve/reject (dual-control states)
6. Preflight missing-info panel → \`POST .../info\`
7. Credentials / registration / OTP / shell panels
8. Findings + promote
9. Tool-install admin queue
10. Policy editor for customer agreement text

### Customer portal must implement

1. \`GET /agi/access\` shell gate
2. Agreement modal
3. Org settings (enable, limits, dual control)
4. Mode switcher Agent vs AGI (intent API)
5. Same session UX with dual-control copy when required

### SSE events (runner → FE via proxy)

| Event | Meaning |
|-------|---------|
| \`session_start\` | Container up |
| \`token\` / \`assistant_done\` | Model stream |
| \`action\` / \`action_pending\` | Tool / gate |
| \`action_executed\` / \`action_rejected\` | Decision result |
| \`finding\` | Evidence finding |
| \`info_request\` / \`info_provided\` | Preflight |
| \`otp_wait\` / \`otp_provided\` | MFA wait |
| \`shell\` | Shell result |
| \`policy_block\` | Forbidden prompt |
| \`teardown\` | Session end |

---

## 21. Operational runbooks

### Runner down

1. \`docker ps | grep phantix-agi\`
2. \`curl localhost:8095/health\`
3. Logs: \`docker logs phantix-agi --tail 200\`
4. Confirm API \`PHANTIX_AGI_SERVICE_URL\` DNS works from API container

### DeepSeek not answering

1. \`deepseek_configured\` in \`/health\`
2. Key length / quota on DeepSeek console
3. Model name (\`DEEPSEEK_MODEL\`)

### Containers not spawning

1. Runner has docker CLI + \`/var/run/docker.sock\`
2. Image \`phantix-agi-sandbox:latest\` exists
3. \`/health\` shows \`"docker": true\`

### Preflight stuck not ready

1. \`GET .../preflight\` → missing keys
2. Supply via \`POST .../info\` or registration/credentials
3. Re-check; do not bypass by inventing assets

### Coolify redeploy resets URL

Set \`PHANTIX_AGI_SERVICE_URL=http://phantix-agi:8095\` in Coolify **UI** env (encrypted store), not only host \`.env\` file.

---

## 22. Related docs

| Doc | Audience |
|-----|----------|
| [PHANTIX_AGI.md](./PHANTIX_AGI.md) | Ops / architecture summary |
| [PHANTIX_AGI_CUSTOMER_GUIDE.md](./PHANTIX_AGI_CUSTOMER_GUIDE.md) | Integrators / customers |
| [PHANTIX_AGI_FORBIDDEN.md](./PHANTIX_AGI_FORBIDDEN.md) | Isolation policy index |
| [../services/phantix-agi/forbidden.md](../services/phantix-agi/forbidden.md) | Authoritative forbidden list |
| [../services/phantix-agi/SECURITY_POLICY.md](../services/phantix-agi/SECURITY_POLICY.md) | Runtime policy |
| [frontend/PHANTIX_AGI_MANAGEMENT_FE.md](./frontend/PHANTIX_AGI_MANAGEMENT_FE.md) | Staff FE |
| [frontend/PHANTIX_AGI_THREE_PORTALS_FE.md](./frontend/PHANTIX_AGI_THREE_PORTALS_FE.md) | Three-portal FE |
| [PHANTIX_AGENT_OPENCLAW.md](./PHANTIX_AGENT_OPENCLAW.md) | Classic Phantix Agent (not AGI) |

---

## Contribution checklist

Before opening a PR that touches AGI:

- [ ] Security model still holds (no host shell, no cross-org, no raw multi-tenant DB from runner)
- [ ] Prompt/scope guards updated if new attack surface
- [ ] Schemas + admin/customer routes + runner client aligned
- [ ] Seed skill / preflight catalogs updated if new skill kinds need inputs
- [ ] Unit tests for pure logic (parse, preflight, dual, autonomy)
- [ ] \`pre-commit run\` clean on touched files
- [ ] Docs updated (this guide and FE map if APIs changed)
- [ ] Staging: runner + API URL + alembic head verified when deploy-related

---

*Maintainers: when AGI behavior changes materially, bump the “Last aligned with codebase” line at the top of this document.*
`;
