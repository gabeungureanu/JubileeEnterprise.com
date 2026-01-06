import { getDatabase } from './database.js';
import { hashPassword, verifyPassword, generateId } from '../utils/crypto.js';
import { auditLog, getLogger } from '../utils/logger.js';
import { getConfig } from '../config/index.js';
import type { User } from '../types/index.js';

export interface CreateUserInput {
  email: string;
  password: string;
  displayName?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const db = getDatabase();
  const logger = getLogger();

  const passwordHash = await hashPassword(input.password);
  const id = generateId();

  const [user] = await db<User[]>`
    INSERT INTO users (id, email, password_hash, display_name)
    VALUES (${id}, ${input.email.toLowerCase()}, ${passwordHash}, ${input.displayName ?? null})
    RETURNING
      id,
      email,
      email_verified as "emailVerified",
      password_hash as "passwordHash",
      display_name as "displayName",
      created_at as "createdAt",
      updated_at as "updatedAt",
      last_login_at as "lastLoginAt",
      failed_login_attempts as "failedLoginAttempts",
      locked_until as "lockedUntil"
  `;

  if (user === undefined) {
    throw new Error('Failed to create user');
  }

  logger.info({ userId: id }, 'User created');

  return user;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDatabase();

  const [user] = await db<User[]>`
    SELECT
      id,
      email,
      email_verified as "emailVerified",
      password_hash as "passwordHash",
      display_name as "displayName",
      created_at as "createdAt",
      updated_at as "updatedAt",
      last_login_at as "lastLoginAt",
      failed_login_attempts as "failedLoginAttempts",
      locked_until as "lockedUntil"
    FROM users
    WHERE email = ${email.toLowerCase()}
  `;

  return user ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const db = getDatabase();

  const [user] = await db<User[]>`
    SELECT
      id,
      email,
      email_verified as "emailVerified",
      password_hash as "passwordHash",
      display_name as "displayName",
      created_at as "createdAt",
      updated_at as "updatedAt",
      last_login_at as "lastLoginAt",
      failed_login_attempts as "failedLoginAttempts",
      locked_until as "lockedUntil"
    FROM users
    WHERE id = ${id}
  `;

  return user ?? null;
}

export interface AuthenticateResult {
  success: boolean;
  user?: User;
  error?: 'invalid_credentials' | 'account_locked' | 'user_not_found';
}

export async function authenticateUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuthenticateResult> {
  const db = getDatabase();
  const config = getConfig();

  const user = await findUserByEmail(email);

  if (user === null) {
    auditLog({
      eventType: 'login_failure',
      userId: null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      success: false,
      metadata: { reason: 'user_not_found', email },
    });

    return { success: false, error: 'user_not_found' };
  }

  if (user.lockedUntil !== null && user.lockedUntil > new Date()) {
    auditLog({
      eventType: 'login_failure',
      userId: user.id,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      success: false,
      metadata: { reason: 'account_locked', lockedUntil: user.lockedUntil.toISOString() },
    });

    return { success: false, error: 'account_locked' };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= config.MAX_LOGIN_ATTEMPTS;
    const lockUntil = shouldLock
      ? new Date(Date.now() + config.LOCKOUT_DURATION * 1000)
      : null;

    await db`
      UPDATE users
      SET
        failed_login_attempts = ${newAttempts},
        locked_until = ${lockUntil}
      WHERE id = ${user.id}
    `;

    auditLog({
      eventType: shouldLock ? 'account_locked' : 'login_failure',
      userId: user.id,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      success: false,
      metadata: {
        reason: 'invalid_password',
        failedAttempts: newAttempts,
        locked: shouldLock,
      },
    });

    return { success: false, error: 'invalid_credentials' };
  }

  await db`
    UPDATE users
    SET
      failed_login_attempts = 0,
      locked_until = NULL,
      last_login_at = NOW()
    WHERE id = ${user.id}
  `;

  auditLog({
    eventType: 'login_success',
    userId: user.id,
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
    success: true,
  });

  return { success: true, user };
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const db = getDatabase();
  const passwordHash = await hashPassword(newPassword);

  await db`
    UPDATE users
    SET
      password_hash = ${passwordHash},
      updated_at = NOW()
    WHERE id = ${userId}
  `;

  auditLog({
    eventType: 'password_changed',
    userId,
    ipAddress: null,
    userAgent: null,
    success: true,
  });
}

export async function verifyEmail(userId: string): Promise<void> {
  const db = getDatabase();

  await db`
    UPDATE users
    SET
      email_verified = TRUE,
      updated_at = NOW()
    WHERE id = ${userId}
  `;

  auditLog({
    eventType: 'email_verified',
    userId,
    ipAddress: null,
    userAgent: null,
    success: true,
  });
}
