import { strToU8 } from "fflate";
import type { CampaignDefinition, ProjectManifest, Rick2Project } from "./project-io";

export interface CampaignProgress { completedLevels: string[]; }

export interface CampaignAdvance {
  progress: CampaignProgress;
  nextLevel: string | null;
  campaignComplete: boolean;
}

export function campaignErrors(manifest: ProjectManifest): string[] {
  const campaign = manifest.campaign;
  if (!campaign) return [];
  const errors: string[] = [];
  const order = campaign.order;
  const orderSet = new Set(order);
  if (!order.length) errors.push("Campaign order must contain at least one level");
  if (orderSet.size !== order.length) errors.push("Campaign order contains duplicate levels");
  for (const level of order) if (!manifest.levels.includes(level)) errors.push(`Campaign level is not declared: ${level}`);
  if (order[0] !== manifest.initialLevel) errors.push("The initial level must be the first campaign level");

  const rules = new Map<string, string[]>();
  for (const rule of campaign.unlockRules) {
    if (rules.has(rule.level)) errors.push(`Campaign has more than one unlock rule for: ${rule.level}`);
    rules.set(rule.level, rule.requiresCompleted);
    if (new Set(rule.requiresCompleted).size !== rule.requiresCompleted.length) errors.push(`Unlock rule contains duplicate requirements: ${rule.level}`);
  }
  for (const [index, level] of order.entries()) {
    const requirements = rules.get(level);
    if (!requirements) { errors.push(`Campaign level has no explicit unlock rule: ${level}`); continue; }
    for (const required of requirements) {
      const requiredIndex = order.indexOf(required);
      if (requiredIndex < 0) errors.push(`Unlock requirement is not in the campaign: ${required}`);
      else if (requiredIndex >= index) errors.push(`Unlock requirement must precede ${level}: ${required}`);
    }
    if (index > 0 && !requirements.includes(order[index - 1]!)) {
      errors.push(`Unlock rule must require the previous campaign level: ${level}`);
    }
  }
  for (const level of rules.keys()) if (!orderSet.has(level)) errors.push(`Unlock rule targets a level outside the campaign: ${level}`);
  return errors;
}

export function assertValidCampaign(manifest: ProjectManifest): void {
  const errors = campaignErrors(manifest);
  if (errors.length) throw new Error(errors[0]);
}

export function isLevelUnlocked(manifest: ProjectManifest, level: string, progress: CampaignProgress): boolean {
  if (!manifest.levels.includes(level)) return false;
  if (!manifest.campaign) return true;
  assertValidCampaign(manifest);
  const rule = manifest.campaign.unlockRules.find((candidate) => candidate.level === level);
  if (!rule) return false;
  const completed = new Set(progress.completedLevels);
  return rule.requiresCompleted.every((required) => completed.has(required));
}

export function advanceCampaign(
  manifest: ProjectManifest,
  progress: CampaignProgress,
  completedLevel: string,
): CampaignAdvance {
  const campaign = manifest.campaign;
  if (!campaign) return { progress: { completedLevels: [...new Set(progress.completedLevels)] }, nextLevel: null, campaignComplete: false };
  assertValidCampaign(manifest);
  if (!campaign.order.includes(completedLevel)) throw new Error(`Level is not in the campaign: ${completedLevel}`);
  if (!isLevelUnlocked(manifest, completedLevel, progress)) throw new Error(`Level is locked: ${completedLevel}`);
  const completedLevels = [...new Set([...progress.completedLevels.filter((level) => campaign.order.includes(level)), completedLevel])];
  const updated = { completedLevels };
  const currentIndex = campaign.order.indexOf(completedLevel);
  const nextLevel = campaign.order.slice(currentIndex + 1).find((level) => isLevelUnlocked(manifest, level, updated)) ?? null;
  return { progress: updated, nextLevel, campaignComplete: completedLevels.length === campaign.order.length };
}

export function defineCampaign(project: Rick2Project, campaign: CampaignDefinition | undefined): void {
  const previous = project.manifest.campaign;
  if (campaign) project.manifest.campaign = structuredClone(campaign);
  else delete project.manifest.campaign;
  try { assertValidCampaign(project.manifest); }
  catch (error) {
    if (previous) project.manifest.campaign = previous;
    else delete project.manifest.campaign;
    throw error;
  }
  project.files.set("project.json", strToU8(`${JSON.stringify(project.manifest, null, 2)}\n`));
}
