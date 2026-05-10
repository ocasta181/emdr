import { Rectangle, Texture } from "pixi.js";
import type { GuideSpriteClip } from "./guideSceneModel";

export const guideSpriteFrameRate = 12;
export const guideSpriteCellSize = 101;

export type GuideSpriteSheet = {
  clips: Record<GuideSpriteClip, Texture[]>;
  bookAtRest: Texture;
};

const sheetColumns = 14;

const guideClipFrames: Record<GuideSpriteClip, { start: number; count: number }> = {
  idle: { start: 1, count: 10 },
  speaking: { start: 11, count: 8 },
  thinking: { start: 19, count: 10 },
  idle_to_speaking: { start: 29, count: 4 },
  idle_to_thinking: { start: 33, count: 5 },
  idle_to_idle_closed_book: { start: 38, count: 14 },
  idle_closed_book: { start: 52, count: 10 },
  idle_closed_book_to_speaking_closed_book: { start: 62, count: 4 },
  speaking_closed_book: { start: 66, count: 8 },
  idle_closed_book_to_thinking_closed_book: { start: 74, count: 5 },
  thinking_closed_book: { start: 79, count: 10 },
  idle_closed_book_to_idle_open_book: { start: 89, count: 10 },
  idle_open_book: { start: 99, count: 10 },
  idle_open_book_to_speaking_open_book: { start: 109, count: 4 },
  speaking_open_book: { start: 113, count: 8 },
  idle_open_book_to_thinking_open_book: { start: 121, count: 5 },
  thinking_open_book: { start: 126, count: 10 },
  flip_book_pages: { start: 136, count: 10 },
  write_in_book: { start: 146, count: 8 }
};

export function createGuideSpriteSheet(sheetTexture: Texture): GuideSpriteSheet {
  const clips = Object.fromEntries(
    Object.entries(guideClipFrames).map(([clip, frameRange]) => [
      clip,
      createFrameRange(sheetTexture, frameRange.start, frameRange.count)
    ])
  ) as Record<GuideSpriteClip, Texture[]>;

  return {
    clips,
    bookAtRest: createFrameTexture(sheetTexture, 154)
  };
}

function createFrameRange(sheetTexture: Texture, start: number, count: number) {
  return Array.from({ length: count }, (_, index) => createFrameTexture(sheetTexture, start + index));
}

function createFrameTexture(sheetTexture: Texture, oneBasedFrameIndex: number) {
  const frameIndex = oneBasedFrameIndex - 1;
  const column = frameIndex % sheetColumns;
  const row = Math.floor(frameIndex / sheetColumns);

  return new Texture({
    source: sheetTexture.source,
    frame: new Rectangle(
      column * guideSpriteCellSize,
      row * guideSpriteCellSize,
      guideSpriteCellSize,
      guideSpriteCellSize
    )
  });
}
