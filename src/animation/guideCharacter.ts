import { AnimatedSprite, Assets, Container, Sprite, type Texture } from "pixi.js";
import {
  guideAnimationIntentKey,
  independentBookStateForBookState,
  independentBookStateForStep,
  planGuideAnimation,
  type BookState,
  type GuideAnimationIntent,
  type GuideAnimationStep
} from "./guideAnimationModel";
import { actionClipForStep, createGuideSpriteSheet, guideSpriteCellSize, guideSpriteFrameRate } from "./guideSpriteSheet";
import guideSpriteSheetUrl from "../../assets/animated-room/guide-sprite-sheet-154.png?url";

export type GuideCharacterBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};

export type GuideCharacterLayout = {
  x: number;
  baselineY: number;
  size: number;
};

export class GuideCharacter {
  readonly container = new Container();

  private readonly guide;
  private readonly targetBook;
  private readonly guideSheet;
  private activeClipKey = "";
  private currentBookState: BookState = "on_ground";
  private activeStep: GuideAnimationStep | null = null;
  private lastIntentKey: string | null = null;
  private completedIntentKey: string | null = null;
  private guideBaselineY = 0;
  private targetBookBounds: GuideCharacterBounds = { x: 0, y: 0, width: 0, height: 0, visible: false };
  private onActionComplete;

  private constructor({
    sheetTexture,
    onTargetBookSelected,
    onActionComplete
  }: {
    sheetTexture: Texture;
    onTargetBookSelected: () => void;
    onActionComplete: () => void;
  }) {
    this.guideSheet = createGuideSpriteSheet(sheetTexture);
    this.guide = new AnimatedSprite(this.guideSheet.idleClips.on_ground);
    this.targetBook = new Sprite(this.guideSheet.bookAtRest);
    this.onActionComplete = onActionComplete;

    this.guide.anchor.set(0.5, 1);
    this.guide.animationSpeed = guideSpriteFrameRate / 60;
    this.guide.loop = true;
    this.guide.play();

    this.targetBook.anchor.set(0.5, 1);
    this.targetBook.eventMode = "static";
    this.targetBook.cursor = "pointer";
    this.targetBook.on("pointertap", onTargetBookSelected);

    this.container.addChild(this.targetBook, this.guide);
  }

  static async load(options: { onTargetBookSelected: () => void; onActionComplete: () => void }) {
    const sheetTexture = await Assets.load<Texture>(guideSpriteSheetUrl);
    return new GuideCharacter({ sheetTexture, ...options });
  }

  setActionCompleteHandler(onActionComplete: () => void) {
    this.onActionComplete = onActionComplete;
  }

  layout({ x, baselineY, size }: GuideCharacterLayout) {
    this.guideBaselineY = baselineY;
    this.guide.position.set(x, baselineY);
    this.guide.width = size;
    this.guide.height = size;

    const targetBookSize = size * 0.46;
    const scale = targetBookSize / guideSpriteCellSize;
    const targetBookX = x - size * 0.32;
    const targetBookY = baselineY - size * 0.02;
    this.targetBook.position.set(targetBookX, targetBookY);
    this.targetBook.width = guideSpriteCellSize * scale;
    this.targetBook.height = guideSpriteCellSize * scale;
    this.targetBookBounds = {
      x: targetBookX - 54,
      y: targetBookY - 54,
      width: 108,
      height: 72,
      visible: this.targetBook.visible
    };
  }

  setFrame({ breath, alpha }: { breath: number; alpha: number }) {
    this.guide.y = this.guideBaselineY + breath;
    this.guide.alpha = alpha;
  }

  sync(intent: GuideAnimationIntent) {
    const intentKey = guideAnimationIntentKey(intent);
    if (this.lastIntentKey !== intentKey) {
      this.lastIntentKey = intentKey;
      this.completedIntentKey = null;
    }

    if (this.activeStep) return;

    const [nextStep] = this.completedIntentKey === intentKey ? [] : planGuideAnimation(this.currentBookState, intent);
    if (!nextStep) {
      this.playIdle(this.currentBookState);
      return;
    }

    this.completedIntentKey = null;
    this.activeStep = nextStep;
    this.playStep(nextStep, () => {
      this.currentBookState = nextStep.to;
      this.activeStep = null;
      if (this.lastIntentKey === intentKey && intent.type === "action" && nextStep.action === intent.action) {
        this.completedIntentKey = intentKey;
        this.onActionComplete();
      }
    });
  }

  syncTargetBookVisibility() {
    const independentBookState = this.activeStep
      ? independentBookStateForStep(this.activeStep, this.activeStepProgress())
      : independentBookStateForBookState(this.currentBookState);
    this.targetBook.visible = independentBookState === "visible";
    this.targetBookBounds = { ...this.targetBookBounds, visible: this.targetBook.visible };
  }

  getTargetBookBounds() {
    return this.targetBookBounds;
  }

  private playStep(step: GuideAnimationStep, onComplete: () => void) {
    const clip = actionClipForStep(this.guideSheet, step);
    const clipKey = `${step.action}:${step.from}:${clip.reverse ? "reverse" : "forward"}:once`;
    if (clipKey === this.activeClipKey) return;

    this.activeClipKey = clipKey;
    this.guide.textures = clip.reverse ? clip.textures.slice().reverse() : clip.textures;
    this.guide.loop = false;
    this.guide.animationSpeed = guideSpriteFrameRate / 60;
    this.guide.onComplete = onComplete;
    this.guide.gotoAndPlay(0);
  }

  private playIdle(state: BookState) {
    const clipKey = `idle:${state}:loop`;
    if (clipKey === this.activeClipKey) return;

    this.activeClipKey = clipKey;
    this.guide.textures = this.guideSheet.idleClips[state];
    this.guide.loop = true;
    this.guide.animationSpeed = guideSpriteFrameRate / 60;
    this.guide.onComplete = undefined;
    this.guide.gotoAndPlay(0);
  }

  private activeStepProgress() {
    const frameCount = this.guide.textures.length;
    if (frameCount <= 1) return 1;
    return this.guide.currentFrame / (frameCount - 1);
  }
}
