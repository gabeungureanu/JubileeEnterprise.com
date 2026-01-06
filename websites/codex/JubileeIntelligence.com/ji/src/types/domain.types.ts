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

export interface DomainNode {
  id: string;
  name: string;
  type: 'domain' | 'group' | 'individual' | 'shared';
  path: string;
  children?: DomainNode[];
  entryCount?: number;
  icon?: string;
}

export const DOMAIN_ICONS: Record<RootDomain, string> = {
  Personas: 'Users',
  Abilities: 'Zap',
  Ministries: 'Church',
  Models: 'Cpu',
  Guardrails: 'Shield',
  Languages: 'Globe',
  Scripture: 'BookOpen',
  Campaigns: 'Megaphone',
  Communities: 'Home',
  Objects: 'Box',
  Users: 'User',
  System: 'Settings'
};

// Persona hierarchy structure
export const PERSONA_HIERARCHY = {
  Inspire: {
    _shared: true,
    individuals: [
      'Jubilee', 'Melody', 'Zariah', 'Elias', 'Eliana',
      'Caleb', 'Imani', 'Zev', 'Amir', 'Nova', 'Santiago', 'Tahoma'
    ]
  }
};
