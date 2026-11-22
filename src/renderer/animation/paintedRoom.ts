/**
 * Layout for the hand-painted room (assets/animated-room/painted/room.jpg, 1536x1024).
 * All coordinates are in painting pixels and were measured from the generated art, so the
 * interactive objects line up with what is painted. If the art is regenerated, re-measure these.
 */
export const roomArt = { width: 1536, height: 1024 } as const;

export type ArtRect = { x: number; y: number; width: number; height: number };

export const roomRegions = {
  /** Where the guide sits on the open terrace (bottom center of the character). */
  guideBaseline: { x: 768, y: 905 },
  /** Guide height in painting pixels. */
  guideSize: 300,
  lantern: { x: 1305, y: 360, width: 231, height: 392 } satisfies ArtRect,
  lanternWindow: { x: 1378, y: 468, width: 102, height: 86 } satisfies ArtRect,
  chest: { x: 1080, y: 770, width: 256, height: 182 } satisfies ArtRect,
  /** Height of the bilateral stimulation path: the open sky above the mountains. */
  stimulationY: 270
} as const;

export type CoverTransform = { scale: number; offsetX: number; offsetY: number };

/** Fits the painting to cover the viewport, centered, like CSS background-size: cover. */
export function coverTransform(width: number, height: number): CoverTransform {
  const scale = Math.max(width / roomArt.width, height / roomArt.height);
  return {
    scale,
    offsetX: (width - roomArt.width * scale) / 2,
    offsetY: (height - roomArt.height * scale) / 2
  };
}

export function toScreen(transform: CoverTransform, point: { x: number; y: number }) {
  return {
    x: transform.offsetX + point.x * transform.scale,
    y: transform.offsetY + point.y * transform.scale
  };
}

export function rectToScreen(transform: CoverTransform, rect: ArtRect) {
  const origin = toScreen(transform, rect);
  return { x: origin.x, y: origin.y, width: rect.width * transform.scale, height: rect.height * transform.scale };
}
