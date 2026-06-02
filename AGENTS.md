# Codex Instructions

## Source of Truth

Read `CLAUDE.md` before starting any task in this project. It is the authoritative project brief for architecture, workflow, conventions, and roadmap.

This file only adapts that brief to Codex.

## Shared Workspace Context

- Workspace guidance: `../../_workspace/AGENTS.md`
- For UI, visual design, layout, component, token, or frontend polish tasks, consult `../../_systems/0.design-system/CLAUDE.md` and `../../_systems/0.design-system/docs/playbook.md` before creating new patterns.
- Prefer reusing or adapting shared design-system references when they fit this project.

## Codex Skill Routing

- Treat the `Comandos Impeccable — Cuándo Ejecutar` section in `CLAUDE.md` as active for Codex too. Use the matching installed Codex skills proactively when their trigger condition is met.
- Treat the `Agentes Disponibles — Cuándo Activar Cada Uno` section in `CLAUDE.md` as active for Codex too. Use the matching installed Codex skills with the same slug shown there.
- Apply these skills autonomously when the match is clear. Do not wait for an explicit request if `CLAUDE.md` already defines that step as part of the normal workflow.

## Priority

If anything here and `CLAUDE.md` differ, follow `CLAUDE.md` and use this file only as the Codex translation layer.
