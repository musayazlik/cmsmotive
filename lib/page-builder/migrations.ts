import type { PageBuilderData } from "./data";

/**
 * Document migrations (plan 5.7): the schema version travels on the stored
 * page locale, not inside the document. Publishing runs the stored draft
 * through every missing step, so older drafts saved before an editor
 * upgrade can still go live. Migration steps are pure functions over
 * validated documents — prepareDocument runs before and after.
 */

export const CURRENT_SCHEMA_VERSION = 1;

type MigrationStep = {
  /** Schema version the step upgrades FROM. */
  from: number;
  to: number;
  run: (data: PageBuilderData) => PageBuilderData;
};

const MIGRATIONS: MigrationStep[] = [];

export function migrateDocument(
  input: PageBuilderData,
  schemaVersion: number | null,
): { data: PageBuilderData; schemaVersion: number } {
  let data = structuredClone(input);
  let version = schemaVersion ?? CURRENT_SCHEMA_VERSION;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS.find((candidate) => candidate.from === version);
    if (!step) throw new Error(`No migration from document schema version ${version}.`);
    data = step.run(data);
    version = step.to;
  }
  return { data, schemaVersion: CURRENT_SCHEMA_VERSION };
}
