export interface CombatRect { x: number; y: number; width: number; height: number; }
export interface CombatWindow { states: string[]; frames?: number[]; }
export interface HurtboxDefinition extends CombatRect, Partial<CombatWindow> { id: string; }
export interface AttackDefinition extends CombatRect, CombatWindow { id: string; damageType: string; damage: number; hitOnce?: boolean; knockbackX?: number; knockbackY?: number; }
export interface GuardDefinition extends CombatRect, CombatWindow { id: string; damageTypes?: string[]; facingOnly?: boolean; }
export interface CombatProfileDefinition { id: string; faction: string; maxHealth: number; invulnerabilityTicks?: number; hurtboxes: HurtboxDefinition[]; attacks?: AttackDefinition[]; guards?: GuardDefinition[]; }
export interface CombatDefinition { damageTypes: Array<{ id: string }>; profiles: CombatProfileDefinition[]; }
export interface CombatPose { x: number; y: number; width: number; face: "left" | "right"; state: string; frame: number; activation: number; }
export interface WorldCombatBox extends CombatRect { id: string; }
export interface CombatHit { attack: string; blocked: boolean; damage: number; damageType: string; knockbackX: number; knockbackY: number; }

const finite = (value: number): boolean => Number.isFinite(value);
const validRect = (value: CombatRect): boolean => [value.x, value.y, value.width, value.height].every(finite) && value.width > 0 && value.height > 0;
const active = (window: Partial<CombatWindow>, pose: CombatPose): boolean => (!window.states || window.states.includes(pose.state)) && (!window.frames || window.frames.includes(pose.frame));
const overlaps = (a: CombatRect, b: CombatRect): boolean => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const worldBox = <T extends CombatRect & { id: string }>(box: T, pose: CombatPose): WorldCombatBox => ({ id: box.id, x: pose.x + (pose.face === "left" ? pose.width - box.x - box.width : box.x), y: pose.y + box.y, width: box.width, height: box.height });

export function validateCombat(definition: CombatDefinition): void {
  const damageTypes = new Set<string>(), profiles = new Set<string>();
  for (const type of definition.damageTypes) { if (!type.id.trim() || damageTypes.has(type.id)) throw new Error(`invalid or duplicate damage type: ${type.id}`); damageTypes.add(type.id); }
  for (const profile of definition.profiles) {
    if (!profile.id.trim() || profiles.has(profile.id)) throw new Error(`invalid or duplicate combat profile: ${profile.id}`); profiles.add(profile.id);
    if (!profile.faction.trim() || !Number.isInteger(profile.maxHealth) || profile.maxHealth < 1 || !Number.isInteger(profile.invulnerabilityTicks ?? 0) || (profile.invulnerabilityTicks ?? 0) < 0 || !profile.hurtboxes.length) throw new Error(`invalid combat profile: ${profile.id}`);
    const ids = new Set<string>();
    for (const box of [...profile.hurtboxes, ...(profile.attacks ?? []), ...(profile.guards ?? [])]) { if (!box.id.trim() || ids.has(box.id) || !validRect(box) || (box.states && !box.states.length) || (box.frames && (!box.frames.length || box.frames.some((frame) => !Number.isInteger(frame) || frame < 0)))) throw new Error(`invalid combat box: ${box.id}`); ids.add(box.id); }
    for (const attack of profile.attacks ?? []) if (!damageTypes.has(attack.damageType) || !Number.isInteger(attack.damage) || attack.damage < 1 || !attack.states.length || ![attack.knockbackX ?? 0, attack.knockbackY ?? 0].every(finite)) throw new Error(`invalid attack: ${attack.id}`);
    for (const guard of profile.guards ?? []) if (!guard.states.length || guard.damageTypes?.some((type) => !damageTypes.has(type))) throw new Error(`invalid guard: ${guard.id}`);
  }
}

export class CombatantState {
  health: number; invulnerability = 0; readonly #hits = new Set<string>();
  constructor(readonly profile: CombatProfileDefinition) { this.health = profile.maxHealth; }
  reset(): void { this.health = this.profile.maxHealth; this.invulnerability = 0; this.#hits.clear(); }
  step(): void { if (this.invulnerability > 0) this.invulnerability--; }
  canHit(attack: string, activation: number): boolean { return !this.#hits.has(`${attack}:${activation}`); }
  recordHit(attack: string, activation: number): void { this.#hits.add(`${attack}:${activation}`); }
  receive(hit: CombatHit): boolean { if (hit.blocked || this.invulnerability > 0 || this.health <= 0) return false; this.health = Math.max(0, this.health - hit.damage); this.invulnerability = this.profile.invulnerabilityTicks ?? 0; return true; }
  get alive(): boolean { return this.health > 0; }
}

export function activeHurtboxes(profile: CombatProfileDefinition, pose: CombatPose): WorldCombatBox[] { return profile.hurtboxes.filter((box) => active(box, pose)).map((box) => worldBox(box, pose)); }
export function activeAttackboxes(profile: CombatProfileDefinition, pose: CombatPose): WorldCombatBox[] { return (profile.attacks ?? []).filter((box) => active(box, pose)).map((box) => worldBox(box, pose)); }
export function activeGuardboxes(profile: CombatProfileDefinition, pose: CombatPose): WorldCombatBox[] { return (profile.guards ?? []).filter((box) => active(box, pose)).map((box) => worldBox(box, pose)); }

export function resolveCombat(attacker: CombatantState, attackerPose: CombatPose, defender: CombatantState, defenderPose: CombatPose, friendlyFire = false): CombatHit | null {
  if ((!friendlyFire && attacker.profile.faction === defender.profile.faction) || !attacker.alive || !defender.alive) return null;
  const hurtboxes = activeHurtboxes(defender.profile, defenderPose), guards = defender.profile.guards ?? [];
  for (const attack of attacker.profile.attacks ?? []) {
    if (!active(attack, attackerPose) || (attack.hitOnce ?? true) && !attacker.canHit(attack.id, attackerPose.activation)) continue;
    const box = worldBox(attack, attackerPose); if (!hurtboxes.some((hurtbox) => overlaps(box, hurtbox))) continue;
    const guard = guards.find((candidate) => active(candidate, defenderPose) && (!candidate.damageTypes || candidate.damageTypes.includes(attack.damageType)) && (!(candidate.facingOnly ?? true) || defenderPose.face !== attackerPose.face) && overlaps(box, worldBox(candidate, defenderPose)));
    const hit = { attack: attack.id, blocked: Boolean(guard), damage: attack.damage, damageType: attack.damageType, knockbackX: (attack.knockbackX ?? 0) * (attackerPose.face === "left" ? -1 : 1), knockbackY: attack.knockbackY ?? 0 };
    if (attack.hitOnce ?? true) attacker.recordHit(attack.id, attackerPose.activation); defender.receive(hit); return hit;
  }
  return null;
}
