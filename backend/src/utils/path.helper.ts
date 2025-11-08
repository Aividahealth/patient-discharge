import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Builds the full path to a service account file based on the environment.
 * 
 * In Docker, the working directory is /app, so paths are /app/.settings.{env}/{filename}
 * Locally, paths are relative to process.cwd()/.settings.{env}/{filename}
 * 
 * @param filename - The filename (e.g., 'firestore_sa.json', 'fhir_store_sa.json')
 * @param env - The environment (defaults to NODE_ENV or 'dev')
 * @returns The full path to the service account file
 */
export function buildServiceAccountPath(filename: string, env?: string): string {
  const environment = env || process.env.NODE_ENV || 'dev';
  const settingsDir = `.settings.${environment}`;
  
  // Check if we're in Docker (working directory is /app)
  // Check both the working directory and if the Docker path exists
  const isDocker = process.cwd() === '/app' || (fs.existsSync('/app') && fs.existsSync('/app/.settings.dev'));
  
  if (isDocker) {
    // Docker environment: /app/.settings.{env}/{filename}
    return path.join('/app', settingsDir, filename);
  } else {
    // Local environment: {cwd}/.settings.{env}/{filename}
    return path.resolve(process.cwd(), settingsDir, filename);
  }
}

/**
 * Builds the full path to a service account file, but allows passing a full path
 * for backward compatibility. If a full path is provided, it returns it as-is.
 * If only a filename is provided, it builds the path dynamically.
 * 
 * @param pathOrFilename - Either a full path or just a filename
 * @param env - The environment (defaults to NODE_ENV or 'dev')
 * @returns The full path to the service account file
 */
export function resolveServiceAccountPath(pathOrFilename: string, env?: string): string {
  // If it's already a full path (contains directory separators), return as-is
  if (pathOrFilename.includes(path.sep) || pathOrFilename.startsWith('/')) {
    return pathOrFilename;
  }
  
  // Otherwise, treat it as a filename and build the path
  return buildServiceAccountPath(pathOrFilename, env);
}

