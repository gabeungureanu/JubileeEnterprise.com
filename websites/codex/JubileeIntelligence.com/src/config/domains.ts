export const ROOT_DOMAINS = [
  'Personas',
  'Abilities',
  'Ministries',
  'Models',
  'Guardrails',
  'Languages',
  'Scripture',
  'Campaigns',
  'Communities',
  'Objects',
  'Users',
  'System'
] as const;

export type RootDomain = typeof ROOT_DOMAINS[number];

export const SCOPE_LEVELS = ['group', 'individual'] as const;
export type ScopeLevel = typeof SCOPE_LEVELS[number];

export const ENTRY_STATUSES = ['active', 'deprecated', 'draft'] as const;
export type EntryStatus = typeof ENTRY_STATUSES[number];

export const GUARDRAIL_LEVELS = ['low', 'medium', 'high'] as const;
export type GuardrailLevel = typeof GUARDRAIL_LEVELS[number];

// Persona hierarchy (example — extend for other domains)
export const PERSONA_GROUPS = {
  Inspire: [
    '_shared',
    'Jubilee',
    'Melody',
    'Zariah',
    'Elias',
    'Eliana',
    'Caleb',
    'Imani',
    'Zev',
    'Amir',
    'Nova',
    'Santiago',
    'Tahoma'
  ]
} as const;
