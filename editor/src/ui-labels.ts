const LABELS: Readonly<Record<string, string>> = {
  initialLives: "Initial lives",
  damageEnabled: "Damage enabled",
  respawn: "Respawn mode",
  resetTriggersOnDeath: "Reset triggers on death",
  deathAudioSlot: "Death sound",
  playerStates: "Player states",
  enemyStates: "Enemy states",
  objectStates: "Object states",
  audio: "Audio effects",
  onComplete: "On completion",
  reachZone: "Reach zone",
  ini_x: "Start X",
  ini_y: "Start Y",
  ini_state: "Initial state",
  bb_x: "Bounds offset X",
  bb_y: "Bounds offset Y",
  bb_width: "Bounds width",
  bb_height: "Bounds height",
  chk_x: "Checkpoint X",
  chk_y: "Checkpoint Y",
  chk_width: "Checkpoint width",
  chk_height: "Checkpoint height",
  nxt_chks: "Next checkpoints",
  ia_type: "AI type",
  ia_random: "Random AI",
  one_use: "One use",
  onehot: "One shot",
  default_trigger: "Triggered by default",
  trigger_cond: "Trigger condition",
  stop_inactive: "Stop while inactive",
  pl_face: "Player facing",
  speed_x: "Horizontal speed",
  speed_y: "Vertical speed",
  frameDurationTicks: "Frame duration (ticks)",
  frameDurationMs: "Frame duration (ms)",
  visualScale: "Visual scale",
  kind: "Type",
};

export function readableDataLabel(value: string): string {
  const known = LABELS[value];
  if (known) return known;
  const spaced = value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function readableDataPath(path: readonly string[]): string {
  return path
    .filter((part) => part !== "attributes")
    .map((part) => /^\d+$/.test(part) ? String(Number(part) + 1) : readableDataLabel(part))
    .join(" · ");
}
