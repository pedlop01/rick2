import versions from "../../schema/format_versions.json";

type JsonObject = Record<string, unknown>;
type Migration = (document: JsonObject) => JsonObject;

// Keyed by the source version. A migration upgrades exactly one version and is
// applied only to a clone; imported files are never overwritten implicitly.
const LEVEL_MIGRATIONS: Readonly<Record<number, Migration>> = Object.freeze({});

export interface MigrationResult {
  document: JsonObject;
  migratedFrom: number | null;
}

export function prepareLevelForEditing(input: unknown): MigrationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("The level must contain a JSON object");
  }
  let document = structuredClone(input) as JsonObject;
  if (document.kind !== "rick2.level" || !Number.isInteger(document.formatVersion)) {
    throw new Error("The document is not a versioned Rick2 level");
  }
  const sourceVersion = document.formatVersion as number;
  const writableVersion = versions["rick2.level"].write;
  if (sourceVersion > writableVersion) {
    throw new Error(`The level uses an unsupported future version: ${sourceVersion}`);
  }
  while ((document.formatVersion as number) < writableVersion) {
    const version = document.formatVersion as number;
    const migrate = LEVEL_MIGRATIONS[version];
    if (!migrate) throw new Error(`No migration exists from version ${version}`);
    document = migrate(document);
  }
  return { document, migratedFrom: sourceVersion === writableVersion ? null : sourceVersion };
}
