import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceCampaign, campaignErrors, defineCampaign, isLevelUnlocked } from "../test-dist/project-campaign.mjs";
import { createEmptyProject, decodeProjectArchive, encodeProjectArchive } from "../test-dist/project-io.mjs";
import { duplicateLevel, removeLevel, renameLevel, setInitialLevel } from "../test-dist/project-levels.mjs";

function fiveLevelCampaign() {
  const project = createEmptyProject();
  for (const id of ["two", "three", "four", "final"]) duplicateLevel(project, project.manifest.levels.at(-1), id);
  const [one, two, three, four, final] = project.manifest.levels;
  defineCampaign(project, {
    order: [one, two, three, four, final],
    unlockRules: [
      { level: one, requiresCompleted: [] },
      { level: two, requiresCompleted: [one] },
      { level: three, requiresCompleted: [two] },
      { level: four, requiresCompleted: [three] },
      { level: final, requiresCompleted: [one, two, three, four] },
    ],
  });
  return project;
}

test("campaign progression follows data-driven order and explicit unlock rules", () => {
  const project = fiveLevelCampaign();
  const [one, two, three, four, final] = project.manifest.campaign.order;
  let progress = { completedLevels: [] };
  assert.equal(isLevelUnlocked(project.manifest, one, progress), true);
  assert.equal(isLevelUnlocked(project.manifest, two, progress), false);
  assert.equal(isLevelUnlocked(project.manifest, final, progress), false);
  for (const [level, expectedNext] of [[one, two], [two, three], [three, four]]) {
    const result = advanceCampaign(project.manifest, progress, level);
    progress = result.progress;
    assert.equal(result.nextLevel, expectedNext);
    assert.equal(isLevelUnlocked(project.manifest, final, progress), false);
  }
  const fourth = advanceCampaign(project.manifest, progress, four);
  assert.equal(fourth.nextLevel, final);
  assert.equal(isLevelUnlocked(project.manifest, final, fourth.progress), true);
  const ending = advanceCampaign(project.manifest, fourth.progress, final);
  assert.equal(ending.nextLevel, null);
  assert.equal(ending.campaignComplete, true);
});

test("projects without a campaign retain unrestricted level compatibility", () => {
  const project = createEmptyProject();
  const second = duplicateLevel(project, project.manifest.initialLevel, "second");
  assert.equal(project.manifest.campaign, undefined);
  assert.equal(isLevelUnlocked(project.manifest, second, { completedLevels: [] }), true);
  assert.deepEqual(advanceCampaign(project.manifest, { completedLevels: [] }, second), {
    progress: { completedLevels: [] }, nextLevel: null, campaignComplete: false,
  });
  assert.equal(campaignErrors(project.manifest).length, 0);
});

test("campaign invariants reject implicit, cyclic and undeclared progression", () => {
  const project = createEmptyProject();
  const second = duplicateLevel(project, project.manifest.initialLevel, "second");
  assert.throws(() => defineCampaign(project, {
    order: [project.manifest.initialLevel, second],
    unlockRules: [{ level: project.manifest.initialLevel, requiresCompleted: [] }],
  }), /no explicit unlock rule/);
  assert.throws(() => defineCampaign(project, {
    order: [project.manifest.initialLevel, second],
    unlockRules: [
      { level: project.manifest.initialLevel, requiresCompleted: [second] },
      { level: second, requiresCompleted: [project.manifest.initialLevel] },
    ],
  }), /must precede/);
  assert.throws(() => defineCampaign(project, {
    order: [project.manifest.initialLevel, second],
    unlockRules: [
      { level: project.manifest.initialLevel, requiresCompleted: [] },
      { level: second, requiresCompleted: [] },
    ],
  }), /previous campaign level/);
  assert.equal(project.manifest.campaign, undefined);
});

test("loading rejects semantically invalid campaign manifests", () => {
  const project = fiveLevelCampaign();
  project.manifest.campaign.unlockRules.at(-1).requiresCompleted = [];
  project.files.set("project.json", new TextEncoder().encode(JSON.stringify(project.manifest)));
  assert.throws(() => decodeProjectArchive(encodeProjectArchive(project)), /previous campaign level/);
});

test("level operations preserve campaign references and constraints", () => {
  const project = fiveLevelCampaign();
  const oldPath = project.manifest.campaign.order[1];
  const renamed = renameLevel(project, oldPath, "renamed");
  assert.equal(project.manifest.campaign.order[1], renamed);
  assert.ok(project.manifest.campaign.unlockRules.some((rule) => rule.requiresCompleted.includes(renamed)));
  assert.throws(() => removeLevel(project, renamed), /from the campaign/);
  assert.throws(() => setInitialLevel(project, renamed), /first campaign/);
  assert.deepEqual(decodeProjectArchive(encodeProjectArchive(project)).manifest.campaign, project.manifest.campaign);
});
