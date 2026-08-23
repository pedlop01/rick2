import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export interface ProjectManifest {
  formatVersion: 1;
  kind: "rick2.project";
  id: string;
  name: string;
  initialLevel: string;
  levels: string[];
}

export interface Rick2Project {
  manifest: ProjectManifest;
  files: Map<string, Uint8Array>;
}

const JSON_INDENT = 2;

export function normalizeProjectPath(input: string): string {
  const path = input.replaceAll("\\", "/");
  if (!path || path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    throw new Error(`Ruta de proyecto no permitida: ${input}`);
  }
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Ruta de proyecto no permitida: ${input}`);
  }
  return parts.join("/");
}

function parseJson<T>(bytes: Uint8Array, path: string): T {
  try {
    return JSON.parse(strFromU8(bytes)) as T;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON no válido en ${path}: ${message}`);
  }
}

function validateManifest(value: unknown): ProjectManifest {
  if (!value || typeof value !== "object") {
    throw new Error("project.json debe contener un objeto");
  }
  const manifest = value as Partial<ProjectManifest>;
  if (manifest.formatVersion !== 1 || manifest.kind !== "rick2.project") {
    throw new Error("Versión o tipo de proyecto no soportado");
  }
  if (typeof manifest.id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/.test(manifest.id)) {
    throw new Error("El identificador del proyecto no es válido");
  }
  if (typeof manifest.name !== "string" || !manifest.name.trim()) {
    throw new Error("El proyecto necesita un nombre");
  }
  if (typeof manifest.initialLevel !== "string" || !Array.isArray(manifest.levels)) {
    throw new Error("El manifiesto no declara sus niveles");
  }
  const initialLevel = normalizeProjectPath(manifest.initialLevel);
  const levels = manifest.levels.map((path) => normalizeProjectPath(path));
  if (!levels.includes(initialLevel) || new Set(levels).size !== levels.length) {
    throw new Error("El nivel inicial debe existir una sola vez en levels");
  }
  return { ...manifest, initialLevel, levels } as ProjectManifest;
}

export function loadProjectFiles(input: ReadonlyMap<string, Uint8Array>): Rick2Project {
  const files = new Map<string, Uint8Array>();
  for (const [rawPath, bytes] of input) {
    const path = normalizeProjectPath(rawPath);
    if (files.has(path)) throw new Error(`Archivo duplicado: ${path}`);
    files.set(path, bytes.slice());
  }
  const manifestBytes = files.get("project.json");
  if (!manifestBytes) throw new Error("El proyecto no contiene project.json");
  if (!files.has("game.json")) throw new Error("El proyecto no contiene game.json");
  const manifest = validateManifest(parseJson<unknown>(manifestBytes, "project.json"));
  for (const level of manifest.levels) {
    const bytes = files.get(level);
    if (!bytes) throw new Error(`Falta el nivel declarado: ${level}`);
    parseJson<unknown>(bytes, level);
  }
  return { manifest, files };
}

export function decodeProjectArchive(bytes: Uint8Array): Rick2Project {
  let archive: Record<string, Uint8Array>;
  try {
    archive = unzipSync(bytes);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo abrir el ZIP: ${message}`);
  }
  return loadProjectFiles(new Map(
    Object.entries(archive).filter(([path]) => !path.endsWith("/")),
  ));
}

export function resolveProjectReference(fromFile: string, reference: string): string {
  if (!reference || reference.startsWith("/") || /^[a-zA-Z][a-zA-Z+.-]*:/.test(reference) ||
      reference.includes("\\")) {
    throw new Error(`Referencia de asset no permitida: ${reference}`);
  }
  const parts = normalizeProjectPath(fromFile).split("/");
  parts.pop();
  for (const part of reference.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new Error(`El asset sale del proyecto: ${reference}`);
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return normalizeProjectPath(parts.join("/"));
}

export function getProjectAsset(
  project: Rick2Project,
  fromFile: string,
  reference: string,
): Uint8Array {
  const path = resolveProjectReference(fromFile, reference);
  const bytes = project.files.get(path);
  if (!bytes) throw new Error(`Asset no encontrado: ${path}`);
  return bytes;
}

export function encodeProjectArchive(project: Rick2Project): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const path of [...project.files.keys()].sort()) {
    const bytes = project.files.get(path);
    if (bytes) files[normalizeProjectPath(path)] = bytes;
  }
  return zipSync(files, { level: 6 });
}

function jsonBytes(value: unknown): Uint8Array {
  return strToU8(`${JSON.stringify(value, null, JSON_INDENT)}\n`);
}

export function createEmptyProject(id = "new-game", name = "Nuevo juego"): Rick2Project {
  const levelPath = "levels/level1/level.json";
  const manifest: ProjectManifest = {
    formatVersion: 1,
    kind: "rick2.project",
    id,
    name,
    initialLevel: levelPath,
    levels: [levelPath],
  };
  const emptyEntities = {
    platforms: [], items: [], backgroundObjects: [], blocks: [], hazards: [],
    checkpoints: [{
      id: 0, chk_x: 0, chk_y: 0, chk_width: 16, chk_height: 16,
      pl_x: 0, pl_y: 0, pl_face: "right", nxt_chks: [],
    }],
    lasers: [], triggers: [], enemies: [], cameraViews: [],
  };
  const placeholderState = {
    name: "stop",
    id: 0,
    animation: {
      bitmap: "../../assets/images/placeholder.png",
      frameDurationTicks: 1,
      sprites: [{ x: 0, y: 0, width: 8, height: 8 }],
    },
  };
  const cells = 32 * 25;
  const level = {
    formatVersion: 1,
    kind: "rick2.level",
    id: "level1",
    units: { simulationTicksPerSecond: 50, duration: "ticks", distance: "pixels", speed: "pixelsPerTick" },
    display: { width: 1280, height: 960 },
    camera: { x: 0, y: 0, width: 256, height: 200 },
    map: {
      width: 32, height: 25, tileWidth: 8, tileHeight: 8,
      tileset: { image: "../../assets/images/tileset.png", tileCount: 1, columns: 1, imageWidth: 8, imageHeight: 8 },
      layers: { tiles: Array(cells).fill(0), frontTiles: Array(cells).fill(0), collisions: Array(cells).fill(0) },
    },
    entities: emptyEntities,
    player: { definition: "characters/player" },
    projectiles: {
      shoot: { definition: "objects/shoot", width: 1, height: 1, yOffset: 0 },
      bomb: { definition: "objects/bomb", width: 1, height: 1, yOffset: 0 },
    },
    definitions: {
      "characters/player": { kind: "character", name: "player", states: [placeholderState] },
      "objects/shoot": { kind: "object", name: "shoot", states: [placeholderState] },
      "objects/bomb": { kind: "object", name: "bomb", states: [placeholderState] },
    },
    audio: {
      initialMusic: 0,
      music: ["../../assets/audio/music.ogg"],
      effects: Array(7).fill("../../assets/audio/effect.wav"),
    },
  };
  const game = { formatVersion: 1, kind: "rick2.game", initialLevel: levelPath };
  return loadProjectFiles(new Map([
    ["project.json", jsonBytes(manifest)],
    ["game.json", jsonBytes(game)],
    [levelPath, jsonBytes(level)],
  ]));
}

export async function readProjectFile(file: File): Promise<Rick2Project> {
  return decodeProjectArchive(new Uint8Array(await file.arrayBuffer()));
}

export function downloadProject(project: Rick2Project): void {
  const archive = encodeProjectArchive(project);
  const blob = new Blob([archive.slice().buffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.manifest.id}.rick2-project`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function readProjectDirectory(root: FileSystemDirectoryHandle): Promise<Rick2Project> {
  const files = new Map<string, Uint8Array>();
  async function visit(directory: FileSystemDirectoryHandle, prefix: string): Promise<void> {
    const entries = (directory as FileSystemDirectoryHandle & {
      entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    }).entries();
    for await (const [name, handle] of entries) {
      const path = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === "directory") {
        await visit(handle as FileSystemDirectoryHandle, path);
      } else {
        const file = await (handle as FileSystemFileHandle).getFile();
        files.set(path, new Uint8Array(await file.arrayBuffer()));
      }
    }
  }
  await visit(root, "");
  return loadProjectFiles(files);
}

export async function writeProjectDirectory(project: Rick2Project, root: FileSystemDirectoryHandle): Promise<void> {
  for (const [path, bytes] of project.files) {
    const parts = normalizeProjectPath(path).split("/");
    const filename = parts.pop();
    if (!filename) continue;
    let directory = root;
    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create: true });
    }
    const handle = await directory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(bytes.slice().buffer);
    await writable.close();
  }
}

export function supportsDirectoryAccess(): boolean {
  return "showDirectoryPicker" in window;
}

export async function pickProjectDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as Window & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  if (!picker) throw new Error("Este navegador no permite abrir carpetas");
  return picker();
}
