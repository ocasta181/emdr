import { Rectangle, Texture } from "pixi.js";
import type { BookState, GuideAction, GuideAnimationStep } from "./guideAnimationModel";

export const guideSpriteFrameRate = 5;
export const guideSpriteCellSize = 128;

export type GuideActionClipKey = `${GuideAction}:${BookState}`;

export type GuideActionClip = {
  textures: Texture[];
  reverseOrder: boolean;
};

export type GuideSpriteSheet = {
  idleClips: Record<BookState, Texture[]>;
  actionClips: Partial<Record<GuideActionClipKey, GuideActionClip>>;
  bookAtRest: Texture;
};

const sheetColumns = 14;

const idleClipFrames: Record<BookState, { start: number; count: number }> = {
  on_ground: { start: 1, count: 10 },
  in_hand_closed: { start: 59, count: 10 },
  in_hand_open: { start: 99, count: 10 }
};

const actionClipFrames: Partial<Record<GuideActionClipKey, { start: number; count: number; reverseOrder?: boolean }>> = {
  "pick_up_book:on_ground": { start: 50, count: 10 },
  "put_down_book:in_hand_closed": { start: 50, count: 10, reverseOrder: true },
  "open_book:in_hand_closed": { start: 89, count: 10 },
  "close_book:in_hand_open": { start: 89, count: 10, reverseOrder: true },
  "flip_through_book:in_hand_open": { start: 121, count: 4 },
  "write_in_book:in_hand_open": { start: 141, count: 13 },
  "speak:on_ground": { start: 29, count: 4 },
  "speak:in_hand_closed": { start: 62, count: 4 },
  "speak:in_hand_open": { start: 109, count: 4 },
  "think:on_ground": { start: 33, count: 5 },
  "think:in_hand_closed": { start: 74, count: 5 },
  "think:in_hand_open": { start: 121, count: 5 }
};

export function createGuideSpriteSheet(sheetTexture: Texture): GuideSpriteSheet {
  const idleClips = Object.fromEntries(
    Object.entries(idleClipFrames).map(([state, frameRange]) => [
      state,
      createFrameRange(sheetTexture, frameRange.start, frameRange.count)
    ])
  ) as Record<BookState, Texture[]>;

  const actionClips = Object.fromEntries(
    Object.entries(actionClipFrames).map(([key, frameRange]) => [
      key,
      {
        textures: createFrameRange(sheetTexture, frameRange.start, frameRange.count),
        reverseOrder: frameRange.reverseOrder ?? false
      }
    ])
  ) as Partial<Record<GuideActionClipKey, GuideActionClip>>;

  return {
    idleClips,
    actionClips,
    bookAtRest: createFrameTexture(sheetTexture, 154)
  };
}

export function actionClipForStep(sheet: GuideSpriteSheet, step: GuideAnimationStep): GuideActionClip {
  const key = `${step.action}:${step.from}` satisfies GuideActionClipKey;
  const clip = sheet.actionClips[key];
  if (!clip) {
    throw new Error(`No guide animation clip for ${key}.`);
  }
  return clip;
}

function createFrameRange(sheetTexture: Texture, start: number, count: number) {
  return Array.from({ length: count }, (_, index) => createFrameTexture(sheetTexture, start + index));
}

function createFrameTexture(sheetTexture: Texture, oneBasedFrameIndex: number) {
  const frameIndex = oneBasedFrameIndex - 1;
  const column = frameIndex % sheetColumns;
  const row = Math.floor(frameIndex / sheetColumns);
  const frame = new Rectangle(
    column * guideSpriteCellSize,
    row * guideSpriteCellSize,
    guideSpriteCellSize,
    guideSpriteCellSize
  );

  return new Texture({
    source: sheetTexture.source,
    frame,
    orig: new Rectangle(0, 0, guideSpriteCellSize, guideSpriteCellSize)
  });
}
