# AGENTS.md

Welcome to the **Seven Solution** repository. This project is a premium enterprise management system built with Next.js, Genkit AI, and MySQL.

This file provides guidance for AI agents working on this codebase.

## ⛔ Project Boundary (MANDATORY)

This is the **Seven Solution** project. Its database is **`seven_solution`** (see `DATABASE_NAME` in `.env`).

- **NEVER read, query, copy from, write to, or modify any other project's database or files.** In particular `erp_database` belongs to the **Color Hut** project, and the same MySQL server also hosts other unrelated databases (`amenu`, `brandiumdb`, `elitdevs_*`, `laravel-crm`, `piprapay`, `wellkitc_web`, …). None of them are ours. Do not even run `SHOW DATABASES` to browse them, and never use them as a "template" or "source" for schema or seed data.
- Only run SQL, migration scripts and seed scripts against `seven_solution`. If a script uses `.env`, check `DATABASE_NAME` is `seven_solution` first.
- If something needs data or structure that does not exist in `seven_solution`, create it here from this repo's code (`docs/mysql_schema.sql`, the `ensure*` helpers in `src/lib`) or **ask the user**. Do not go and fetch it from another database.
- Never touch other projects' folders either; only work inside this repository (`C:\Seven Solution`).
- Do not read or print personal data (user emails, phone numbers, passwords) from any database unless the task strictly needs it.

## Repository Overview

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **AI Integration**: [Genkit AI](https://firebase.google.com/docs/genkit)
- **Database**: MySQL (via `mysql2`)
- **Styling**: Tailwind CSS & Radix UI
- **Real-time**: Socket.io

## Agent Resources

Detailed instructions and workflows for agents can be found in the `.agent/` directory:

### 🛠️ Workflows

Common tasks and procedures:

- [Development Workflow](.agent/workflows/dev.md): How to run the app locally.
- [Deployment Workflow](.agent/workflows/deploy.md): Procedures for shipping to production.
- [AI Workflow](.agent/workflows/genkit.md): Managing Genkit AI flows and development.

### 🧠 Skills

Specific knowledge bases:

- [Coding Standards](.agent/skills/coding.md): Best practices for this codebase.

### 👤 Persona

- [Interaction Style](.agent/persona.md): User's communication preferences and language requirements.

## Interaction Guidelines

- **Premium UI**: Always prioritize high-end design. Use Radix UI components, Framer Motion for transitions, and curated Color palettes.
- **AI-First**: When building features, consider how Genkit AI can enhance the user experience (e.g., smart summaries, automated forms).
- **Banglish Summary**: Provide a concise summary of the work performed in **Banglish** (Bengali written in Latin/English script) after completing each task. **NEVER use direct Bengali Unicode characters (e.g., বাংলা)** — always write Bengali phonetically in English letters only (e.g., "Ami kaj shesh korlam").
- **Summary of Actions**: After the Banglish summary, provide a clear, bulleted "Summary of Actions" in English to detail the specific technical steps taken.
- **Benefit Comparison Table**: Always provide a comparison table in **Banglish** (using Latin/English script, never Unicode Bengali) showing the **Previous State/Implementation** vs. the **Recent State/Benefits** of your changes at the end of each task.
- **Git Push Policy**: NEVER push code to GitHub automatically after completing a task. Only run `git push` when the user explicitly requests/commands to push to GitHub.
- **Safety**: Ensure all database operations are sanitized and follow the established Zod validation patterns.

## Commit Messages & PR Descriptions

**Prefer Conventional Commits**: `type(scope): subject` (scope optional)
Example: `feat(auth): add user authentication`
*Do not reference Claude in commit messages.*

### PR Description Format

- Start with a short, user-facing paragraph describing the product change.
- Add a **Closes** section with relevant issue links (GitHub, Linear, etc.).
- For feature PRs, add **How to test** from a product/UX standpoint.
- For bugfix PRs, use **How to reproduce** when helpful.
- Optionally add a **What changed** section for implementation highlights.
- *Do not* add a "How this was tested" section listing specs/commands.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
