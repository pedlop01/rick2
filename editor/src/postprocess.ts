import type { PostProcessEffectDefinition } from "./presentation";

export function horizontalStripBaseOffset(strip: number, maxOffset: number): number {
  if (maxOffset <= 0) return 0;
  const span = maxOffset * 2, position = strip % span;
  return position <= maxOffset ? position : span - position;
}

export function horizontalStripOffset(strip: number, effect: PostProcessEffectDefinition, elapsedMs: number): number {
  if (effect.strips <= 0 || effect.periodMs <= 0) return 0;
  const rotations = Math.floor(elapsedMs / effect.periodMs) % effect.strips;
  const source = (strip + effect.strips - rotations) % effect.strips;
  return horizontalStripBaseOffset(source, effect.maxOffset);
}
