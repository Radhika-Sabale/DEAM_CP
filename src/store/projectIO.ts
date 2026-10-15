/**
 * @file projectIO.ts
 * JSON import/export routines with structural validation, field-path diagnostic reporting,
 * and conflict-free project ID generation.
 */

import {
  CURRENT_SCHEMA_VERSION,
  type DesignProject,
} from '../types/designProject';
import type { Result } from './persistence';

/**
 * Envelope structure wrapping exported project JSON.
 */
export interface ProjectExportEnvelope {
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly project: DesignProject;
}

/**
 * Detailed validation failure diagnostic naming the specific field path.
 */
export interface ValidationError {
  readonly field: string;
  readonly message: string;
}

/**
 * Error detail returned when parsing or validating project JSON fails.
 */
export interface JsonImportError {
  readonly code: 'INVALID_JSON' | 'UNSUPPORTED_VERSION' | 'VALIDATION_FAILED';
  readonly message: string;
  readonly fieldErrors?: readonly ValidationError[];
}

/**
 * Exports a DesignProject into a formatted JSON string inside a versioned envelope.
 *
 * @param project The DesignProject to serialize
 * @returns Pretty-printed JSON string
 */
export function exportProjectToJson(project: DesignProject): string {
  const envelope: ProjectExportEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    project,
  };
  return JSON.stringify(envelope, null, 2);
}

import { validateProjectFields } from './projectValidation';


/**
 * Parses and validates a project JSON string, supporting both raw DesignProject
 * JSON and enveloped exports.
 *
 * @param text The input JSON string
 * @returns Result with validated DesignProject or structured error diagnostics
 */
export function parseProjectJson(
  text: string
): Result<DesignProject, JsonImportError> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON syntax.',
      },
    };
  }

  if (typeof raw !== 'object' || raw === null) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Root must be a JSON object.',
        fieldErrors: [{ field: 'root', message: 'Expected JSON object.' }],
      },
    };
  }

  // Detect and unwrap envelope if present
  let candidate: Record<string, unknown>;
  const rawObj = raw as Record<string, unknown>;
  if (
    rawObj['project'] &&
    typeof rawObj['project'] === 'object' &&
    rawObj['project'] !== null
  ) {
    candidate = rawObj['project'] as Record<string, unknown>;
  } else {
    candidate = rawObj;
  }

  // Version check
  const schemaVer = candidate['schemaVersion'];
  if (typeof schemaVer === 'number' && schemaVer > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `Schema version ${schemaVer} is newer than current supported version ${CURRENT_SCHEMA_VERSION}.`,
        fieldErrors: [
          {
            field: 'schemaVersion',
            message: `Version ${schemaVer} exceeds maximum supported version ${CURRENT_SCHEMA_VERSION}.`,
          },
        ],
      },
    };
  }

  // Validate fields
  const fieldErrors = validateProjectFields(candidate);
  if (fieldErrors.length > 0) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Validation failed with ${fieldErrors.length} error(s).`,
        fieldErrors,
      },
    };
  }

  let project = candidate as unknown as DesignProject;
  if (typeof schemaVer === 'number' && schemaVer < CURRENT_SCHEMA_VERSION) {
    project = {
      ...project,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sequentialSpec: project.sequentialSpec ?? null,
    };
  }

  return {
    ok: true,
    value: project,
  };
}

/**
 * Imports a project JSON string, generating a fresh ID if the project's ID
 * collides with an existing locally saved project.
 *
 * @param text JSON string to import
 * @param existingProjectIds List of current local project IDs to prevent overwrite
 * @returns Result with imported DesignProject
 */
export function importProject(
  text: string,
  existingProjectIds: readonly string[] = []
): Result<DesignProject, JsonImportError> {
  const parseResult = parseProjectJson(text);
  if (!parseResult.ok) {
    return parseResult;
  }

  const project = parseResult.value;
  const isDuplicate = existingProjectIds.includes(project.id);

  if (isDuplicate) {
    // Generate fresh collision-free UUID
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const freshId = `proj-${Date.now().toString(36)}-${randomSuffix}`;
    const renamedProject: DesignProject = {
      ...project,
      id: freshId,
      name: `${project.name} (Imported)`,
      updatedAt: new Date().toISOString(),
    };
    return { ok: true, value: renamedProject };
  }

  return { ok: true, value: project };
}
