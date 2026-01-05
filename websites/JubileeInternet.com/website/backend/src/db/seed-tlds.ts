import 'dotenv/config';
import postgres from 'postgres';
import { nanoid } from 'nanoid';
import { JUBILEE_TLDS, type JubileeTLDKey } from '../config/index.js';

async function seedTLDs(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (databaseUrl === undefined) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    console.log('Seeding Jubilee TLDs...\n');

    const tldEntries = Object.entries(JUBILEE_TLDS) as [JubileeTLDKey, typeof JUBILEE_TLDS[JubileeTLDKey]][];

    for (const [tld, config] of tldEntries) {
      const id = nanoid();

      await sql`
        INSERT INTO jubilee_tlds (
          id, tld, display_name, description,
          is_restricted, requires_verification, price_per_year, is_active
        )
        VALUES (
          ${id},
          ${tld},
          ${config.displayName},
          ${config.description},
          ${config.isRestricted},
          ${config.requiresVerification},
          300,
          true
        )
        ON CONFLICT (tld) DO UPDATE SET
          display_name = ${config.displayName},
          description = ${config.description},
          is_restricted = ${config.isRestricted},
          requires_verification = ${config.requiresVerification},
          updated_at = NOW()
      `;

      console.log(`  ✓ .${tld} - ${config.description}`);
    }

    // Seed reserved domains (system, offensive, etc.)
    console.log('\nSeeding reserved domains...\n');

    const reservedNames = [
      // System reserved
      { name: 'www', reason: 'system', notes: 'Reserved web prefix' },
      { name: 'mail', reason: 'system', notes: 'Reserved mail prefix' },
      { name: 'ftp', reason: 'system', notes: 'Reserved FTP prefix' },
      { name: 'api', reason: 'system', notes: 'Reserved API prefix' },
      { name: 'admin', reason: 'system', notes: 'Reserved admin prefix' },
      { name: 'jubilee', reason: 'official', notes: 'Official Jubilee brand' },
      { name: 'jubileebrowser', reason: 'official', notes: 'Official product' },
      { name: 'jubileebible', reason: 'official', notes: 'Official product' },
      { name: 'jubileeinternet', reason: 'official', notes: 'Official service' },
      { name: 'jubileverse', reason: 'official', notes: 'Official platform' },
      { name: 'roundtable', reason: 'official', notes: 'Official feature' },

      // Common system names
      { name: 'root', reason: 'system', notes: 'Reserved system name' },
      { name: 'localhost', reason: 'system', notes: 'Reserved system name' },
      { name: 'server', reason: 'system', notes: 'Reserved system name' },
      { name: 'support', reason: 'official', notes: 'Official support' },
      { name: 'help', reason: 'official', notes: 'Official help' },
      { name: 'account', reason: 'system', notes: 'Reserved for accounts' },
      { name: 'accounts', reason: 'system', notes: 'Reserved for accounts' },
      { name: 'login', reason: 'system', notes: 'Reserved for auth' },
      { name: 'signin', reason: 'system', notes: 'Reserved for auth' },
      { name: 'signup', reason: 'system', notes: 'Reserved for auth' },
      { name: 'register', reason: 'system', notes: 'Reserved for auth' },
    ];

    for (const reserved of reservedNames) {
      const id = nanoid();

      await sql`
        INSERT INTO reserved_domains (id, name, tld_id, reason, notes)
        VALUES (${id}, ${reserved.name}, NULL, ${reserved.reason}, ${reserved.notes})
        ON CONFLICT (name, tld_id) DO NOTHING
      `;

      console.log(`  ✓ ${reserved.name} (${reserved.reason})`);
    }

    console.log('\n✓ TLD and reserved domain seeding completed!');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedTLDs().catch(console.error);
