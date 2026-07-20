// src/composer/slashCommands.ts
// The `/` vocabulary. Each command names an intent family and nothing more.
//
// A slash command asserts the family. It does NOT assert readiness: `/run` still
// resolves to needs-approval, and never becomes execution because a slash
// preceded it.

import type { IntentFamily } from './intentTypes';

export interface SlashCommand {
  /** Command token without the leading slash. */
  name: string;
  family: IntentFamily;
  /** Discriminates within a family, e.g. headroom inspect vs clear. */
  action?: string;
  summary: string;
  /** Shown in the menu as the argument hint. */
  argHint?: string;
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    name: 'open',
    family: 'web-surface',
    summary: 'Open a public webpage or registered application',
    argHint: 'url',
  },
  {
    name: 'project',
    family: 'project',
    summary: 'Choose or change the active project',
    argHint: 'name',
  },
  {
    name: 'inspect',
    family: 'artifact',
    summary: 'Inspect attached or selected context',
    argHint: 'target',
  },
  {
    name: 'run',
    family: 'run',
    summary: 'Propose a governed action requiring approval',
    argHint: 'what to run',
  },
  {
    name: 'evidence',
    family: 'evidence',
    summary: 'Open supporting evidence',
  },
  {
    name: 'rig',
    family: 'rig',
    summary: 'Inspect or connect capabilities',
  },
  {
    name: 'headroom',
    family: 'headroom',
    action: 'inspect',
    summary: 'Inspect active context and freshness',
  },
  {
    name: 'clear-context',
    family: 'headroom',
    action: 'clear',
    summary: 'Remove conversation context without deleting source data',
  },
  {
    name: 'help',
    family: 'converse',
    action: 'help',
    summary: 'Show available actions relevant to the current state',
  },
] as const;

export function findSlashCommand(name: string): SlashCommand | null {
  const lowered = name.toLowerCase();
  return SLASH_COMMANDS.find((command) => command.name === lowered) ?? null;
}

/**
 * Filter commands for the menu. An empty query returns everything, so typing a
 * bare `/` shows the full vocabulary rather than nothing.
 */
export function filterSlashCommands(query: string): SlashCommand[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [...SLASH_COMMANDS];
  return SLASH_COMMANDS.filter(
    (command) =>
      command.name.includes(trimmed) || command.summary.toLowerCase().includes(trimmed),
  );
}

export interface ParsedSlashInput {
  /** Command token as typed, without the slash. May be partial while typing. */
  name: string;
  /** Everything after the first run of whitespace. */
  rest: string;
  /** True once a space follows the command, meaning the token is settled. */
  complete: boolean;
}

/** Parse raw composer input that begins with `/`. Returns null otherwise. */
export function parseSlashInput(input: string): ParsedSlashInput | null {
  if (!input.startsWith('/')) return null;
  const body = input.slice(1);
  const match = body.match(/^(\S*)(\s+)?([\s\S]*)$/);
  if (!match) return { name: '', rest: '', complete: false };
  return {
    name: match[1] ?? '',
    rest: (match[3] ?? '').trim(),
    complete: Boolean(match[2]),
  };
}
