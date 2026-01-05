import 'dotenv/config';
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';

async function seedDev(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (databaseUrl === undefined) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const nodeEnv = process.env['NODE_ENV'];
  if (nodeEnv === 'production') {
    console.error('Cannot seed development data in production environment!');
    process.exit(1);
  }

  const sql = postgres(databaseUrl);

  try {
    console.log('Seeding development data...\n');

    // Create test users
    const testUsers = [
      {
        id: 'test-user-001',
        email: 'test@jubilee.com',
        password: 'TestPassword123!',
        displayName: 'Test User',
      },
      {
        id: 'test-user-002',
        email: 'admin@jubilee.com',
        password: 'AdminPassword123!',
        displayName: 'Admin User',
      },
    ];

    console.log('Creating test users...');
    for (const user of testUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      await sql`
        INSERT INTO users (id, email, password_hash, display_name, email_verified)
        VALUES (${user.id}, ${user.email}, ${passwordHash}, ${user.displayName}, true)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = ${passwordHash},
          display_name = ${user.displayName}
      `;

      console.log(`  ✓ ${user.email} (password: ${user.password})`);
    }

    // Create test OAuth clients
    const testClients = [
      {
        id: 'test-client-browser',
        clientId: 'jubilee-browser-dev',
        clientSecret: 'browser-dev-secret-12345',
        name: 'Jubilee Browser (Development)',
        redirectUris: [
          'https://localhost:8080/callback',
          'http://localhost:8080/callback',
          'jubilee://callback',
        ],
        allowedScopes: ['openid', 'profile', 'email', 'offline_access'],
        allowedGrantTypes: ['authorization_code', 'refresh_token'],
        isConfidential: false,
      },
      {
        id: 'test-client-bible',
        clientId: 'jubilee-bible-dev',
        clientSecret: 'bible-dev-secret-12345',
        name: 'Jubilee Bible (Development)',
        redirectUris: [
          'https://localhost:3001/callback',
          'http://localhost:3001/callback',
        ],
        allowedScopes: ['openid', 'profile', 'email', 'offline_access'],
        allowedGrantTypes: ['authorization_code', 'refresh_token'],
        isConfidential: true,
      },
      {
        id: 'test-client-service',
        clientId: 'jubilee-service-dev',
        clientSecret: 'service-dev-secret-12345',
        name: 'Jubilee Service (Development)',
        redirectUris: [],
        allowedScopes: ['openid'],
        allowedGrantTypes: ['client_credentials'],
        isConfidential: true,
      },
    ];

    console.log('\nCreating test OAuth clients...');
    for (const client of testClients) {
      const secretHash = client.clientSecret !== null
        ? createHash('sha256').update(client.clientSecret).digest('hex')
        : null;

      await sql`
        INSERT INTO oauth_clients (
          id, client_id, client_secret_hash, name,
          redirect_uris, allowed_scopes, allowed_grant_types, is_confidential
        )
        VALUES (
          ${client.id},
          ${client.clientId},
          ${secretHash},
          ${client.name},
          ${client.redirectUris},
          ${client.allowedScopes},
          ${client.allowedGrantTypes},
          ${client.isConfidential}
        )
        ON CONFLICT (client_id) DO UPDATE SET
          client_secret_hash = ${secretHash},
          name = ${client.name},
          redirect_uris = ${client.redirectUris},
          allowed_scopes = ${client.allowedScopes},
          allowed_grant_types = ${client.allowedGrantTypes}
      `;

      console.log(`  ✓ ${client.name}`);
      console.log(`    client_id: ${client.clientId}`);
      if (client.clientSecret !== null) {
        console.log(`    client_secret: ${client.clientSecret}`);
      }
    }

    console.log('\n✓ Development seed completed successfully!');
    console.log('\nTest login credentials:');
    for (const user of testUsers) {
      console.log(`  ${user.email} / ${user.password}`);
    }
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedDev().catch(console.error);
