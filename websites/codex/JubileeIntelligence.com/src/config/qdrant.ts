import fs from 'fs';
import path from 'path';

export interface QdrantCollections {
  personas: string;
  system: string;
}

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collections: QdrantCollections;
  vectorSize: number;
  distance: string;
}

export interface AppConfig {
  version: string;
  qdrant: QdrantConfig;
  embedding: {
    provider: string;
    model: string;
  };
  overlay: {
    dbPath: string;
  };
}

let cachedConfig: AppConfig | null = null;

/**
 * Load configuration from config.json
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.resolve(process.cwd(), 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const configData = fs.readFileSync(configPath, 'utf-8');
  cachedConfig = JSON.parse(configData) as AppConfig;

  return cachedConfig;
}

/**
 * Save configuration to config.json
 */
export function saveConfig(config: AppConfig): void {
  const configPath = path.resolve(process.cwd(), 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
}

/**
 * Increment version by 0.00.001
 * Version format: X.YY.ZZZ (e.g., 8.00.101)
 */
export function incrementVersion(currentVersion: string): string {
  const parts = currentVersion.split('.');
  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${currentVersion}. Expected X.YY.ZZZ`);
  }

  const major = parseInt(parts[0], 10);
  let minor = parseInt(parts[1], 10);
  let patch = parseInt(parts[2], 10);

  // Increment patch
  patch += 1;

  // Handle overflow: if patch >= 1000, roll over to minor
  if (patch >= 1000) {
    patch = 0;
    minor += 1;
  }

  // Handle overflow: if minor >= 100, roll over to major
  if (minor >= 100) {
    minor = 0;
    // major += 1; // Uncomment if you want major to auto-increment
  }

  // Format with leading zeros
  const minorStr = minor.toString().padStart(2, '0');
  const patchStr = patch.toString().padStart(3, '0');

  return `${major}.${minorStr}.${patchStr}`;
}

/**
 * Increment version and save to config
 */
export function bumpVersion(): string {
  const config = loadConfig();
  const newVersion = incrementVersion(config.version);
  config.version = newVersion;
  saveConfig(config);
  return newVersion;
}

/**
 * Get current version
 */
export function getVersion(): string {
  return loadConfig().version;
}

/**
 * Get Qdrant configuration
 */
export function getQdrantConfig(): QdrantConfig {
  const config = loadConfig();
  const apiKey = process.env.QDRANT_API_KEY || config.qdrant.apiKey;
  return {
    url: process.env.QDRANT_URL || config.qdrant.url,
    apiKey: apiKey || undefined,
    collections: config.qdrant.collections,
    vectorSize: config.qdrant.vectorSize,
    distance: config.qdrant.distance
  };
}

/**
 * Get overlay database path
 */
export function getOverlayDbPath(): string {
  return loadConfig().overlay.dbPath;
}

/**
 * Get embedding configuration
 */
export function getEmbeddingConfig(): { provider: string; model: string } {
  return loadConfig().embedding;
}

/**
 * Clear cached config (useful for testing or reloading)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
