import { useEffect, useRef } from "react";
import { AnimatedSprite, Application, Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import {
  guideBookClips,
  independentBookStateForClip,
  targetBookTransition,
  type GuideBookIntent,
  type GuideIntent,
  type SceneViewModel,
  type TargetBookMode
} from "./guideSceneModel";
import guideFrame00Url from "../../assets/animated-room/guide-00.png?url";
import guideFrame01Url from "../../assets/animated-room/guide-01.png?url";
import guideFrame02Url from "../../assets/animated-room/guide-02.png?url";
import guideFrame03Url from "../../assets/animated-room/guide-03.png?url";
import guideFrame04Url from "../../assets/animated-room/guide-04.png?url";
import guideFrame05Url from "../../assets/animated-room/guide-05.png?url";
import guideFrame06Url from "../../assets/animated-room/guide-06.png?url";
import guideFrame07Url from "../../assets/animated-room/guide-07.png?url";
import guideFrame08Url from "../../assets/animated-room/guide-08.png?url";
import guideFrame09Url from "../../assets/animated-room/guide-09.png?url";
import guideFrame10Url from "../../assets/animated-room/guide-10.png?url";
import guideFrame11Url from "../../assets/animated-room/guide-11.png?url";
import orbUrl from "../../assets/animated-room/orb.svg?url";

export type RoomObjectId = "guide" | "targets" | "history" | "settings";

type RoomMode = "idle" | "chat" | "session" | "stimulation";
export type GuideState = "idle" | "listening" | "speaking" | "thinking";

const guideStateFrames: Record<GuideState, number[]> = {
  idle: [0, 1, 2, 11],
  listening: [3, 4, 5],
  speaking: [6, 7, 8],
  thinking: [9, 10, 11]
};

const bookClipDurations: Record<GuideBookIntent, number> = {
  pick_up_book: 1.35,
  hold_book_closed: 1,
  open_book: 1,
  hold_book_open: 1,
  flip_book_pages: 1.2,
  write_in_book: 1,
  close_book: 0.9,
  put_book_down: 1.25
};

const guideFrameUrls = [
  guideFrame00Url,
  guideFrame01Url,
  guideFrame02Url,
  guideFrame03Url,
  guideFrame04Url,
  guideFrame05Url,
  guideFrame06Url,
  guideFrame07Url,
  guideFrame08Url,
  guideFrame09Url,
  guideFrame10Url,
  guideFrame11Url
];

const guideBookFrameModules = import.meta.glob<string>("../../assets/animated-room/guide-book-*.svg", {
  eager: true,
  import: "default",
  query: "?url"
});

const guideBookFrameNames: Record<GuideBookIntent, string[]> = {
  pick_up_book: ["guide-book-pick-up-00.svg", "guide-book-pick-up-01.svg", "guide-book-pick-up-02.svg"],
  hold_book_closed: ["guide-book-hold-closed-00.svg", "guide-book-hold-closed-01.svg", "guide-book-hold-closed-02.svg"],
  open_book: ["guide-book-open-00.svg", "guide-book-open-01.svg", "guide-book-open-02.svg"],
  hold_book_open: ["guide-book-hold-open-00.svg", "guide-book-hold-open-01.svg", "guide-book-hold-open-02.svg"],
  flip_book_pages: ["guide-book-flip-pages-00.svg", "guide-book-flip-pages-01.svg", "guide-book-flip-pages-02.svg"],
  write_in_book: ["guide-book-writing-00.svg", "guide-book-writing-01.svg", "guide-book-writing-02.svg"],
  close_book: ["guide-book-close-00.svg", "guide-book-close-01.svg", "guide-book-close-02.svg"],
  put_book_down: ["guide-book-put-down-00.svg", "guide-book-put-down-01.svg", "guide-book-put-down-02.svg"]
};

type GuideClipKey = GuideState | GuideBookIntent;

export function RoomScene({
  mode,
  guideState,
  sceneViewModel,
  stimulationRunning,
  stimulationColor,
  stimulationSpeed,
  onObjectSelected
}: {
  mode: RoomMode;
  guideState: GuideState;
  sceneViewModel: SceneViewModel;
  stimulationRunning: boolean;
  stimulationColor: string;
  stimulationSpeed: number;
  onObjectSelected: (objectId: RoomObjectId) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onObjectSelected);
  const runtimeRef = useRef({ mode, guideState, sceneViewModel, stimulationRunning, stimulationColor, stimulationSpeed });
  callbackRef.current = onObjectSelected;
  runtimeRef.current = { mode, guideState, sceneViewModel, stimulationRunning, stimulationColor, stimulationSpeed };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const app = new Application();

    async function mount(container: HTMLDivElement) {
      await app.init({
        resizeTo: container,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio, 2)
      });

      if (disposed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);

      const stage = new Container();
      app.stage.addChild(stage);

      const background = new Graphics();
      const hill = new Graphics();
      const moon = new Graphics();
      const guideTextures = await Promise.all(guideFrameUrls.map((url) => Assets.load<Texture>(url)));
      const orbTexture = await Assets.load(orbUrl);
      const guideBookTextures = await loadGuideBookTextures();
      const guideFrames = createGuideFrames(guideTextures, guideBookTextures);
      const guide = new AnimatedSprite(guideFrames.idle);
      const targetBook = new Container();
      const orb = new Sprite(orbTexture);
      const labels = new Container();
      const dimmer = new Graphics();
      const fireflies = Array.from({ length: 18 }, (_, index) => ({
        xSeed: Math.random() * 1000,
        ySeed: Math.random() * 1000,
        speed: 0.35 + Math.random() * 0.75,
        dot: new Graphics(),
        index
      }));

      guide.anchor.set(0.5, 1);
      guide.animationSpeed = 0.035;
      guide.play();
      targetBook.eventMode = "static";
      targetBook.cursor = "pointer";
      targetBook.on("pointertap", () => callbackRef.current("targets"));
      orb.anchor.set(0.5);
      orb.visible = false;
      stage.addChild(background, moon, hill, labels, targetBook, guide);
      for (const firefly of fireflies) {
        stage.addChild(firefly.dot);
      }
      stage.addChild(dimmer, orb);

      const hotspots: Array<{ id: RoomObjectId; label: string; draw: Graphics }> = [
        { id: "guide", label: "Guide", draw: new Graphics() },
        { id: "targets", label: "Targets", draw: new Graphics() },
        { id: "history", label: "History", draw: new Graphics() },
        { id: "settings", label: "Settings", draw: new Graphics() }
      ];

      for (const hotspot of hotspots) {
        hotspot.draw.eventMode = "static";
        hotspot.draw.cursor = "pointer";
        hotspot.draw.on("pointertap", () => callbackRef.current(hotspot.id));
        stage.addChild(hotspot.draw);
      }

      let elapsed = 0;
      let lastWidth = 0;
      let lastHeight = 0;
      let currentGuideClip: GuideClipKey = "idle";
      let settledTargetBookMode: TargetBookMode = "at_rest";
      let desiredTargetBookMode: TargetBookMode = "at_rest";
      let activeBookClip: GuideBookIntent | null = null;
      let bookClipQueue: GuideBookIntent[] = [];
      let bookClipStartedAt = 0;
      let targetBookLayout = { x: 0, y: 0, scale: 1 };
      let targetBookLabel: Text | null = null;

      function drawLabel(text: string, x: number, y: number) {
        const label = new Text({
          text,
          style: {
            fill: "#f4efe2",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 13,
            fontWeight: "600"
          }
        });
        label.anchor.set(0.5);
        label.position.set(x, y);
        labels.addChild(label);
        return label;
      }

      function redraw() {
        const width = app.renderer.width;
        const height = app.renderer.height;
        const floorY = height * 0.78;

        background.clear();
        background.rect(0, 0, width, height).fill("#171614");
        background.rect(0, 0, width, height * 0.62).fill("#23353a");
        background.rect(0, height * 0.44, width, height * 0.56).fill("#2a2a23");
        background.rect(0, height * 0.64, width, height * 0.36).fill("#1d1b18");

        moon.clear();
        moon.circle(width * 0.78, height * 0.19, Math.max(38, width * 0.038)).fill({ color: "#e7dfc9", alpha: 0.82 });
        moon.circle(width * 0.765, height * 0.18, Math.max(42, width * 0.043)).fill({ color: "#23353a", alpha: 0.38 });

        hill.clear();
        hill.ellipse(width * 0.5, floorY + 40, width * 0.42, height * 0.15).fill("#302f28");
        hill.ellipse(width * 0.5, floorY + 26, width * 0.34, height * 0.1).fill("#3d3a31");
        hill.roundRect(width * 0.82, height * 0.56, 80, 110, 8).fill("#383229");
        hill.circle(width * 0.82 + 40, height * 0.55, 30).fill("#52442f");

        labels.removeChildren();
        targetBookLabel = drawLabel("Target book", width * 0.2, floorY + 48);
        drawLabel("Settings", width * 0.82 + 40, height * 0.73);
        drawLabel("History", width * 0.68, height * 0.82);

        guide.position.set(width * 0.5, floorY + 10);
        guide.width = Math.min(220, width * 0.2);
        guide.height = guide.width * 1.18;
        targetBookLayout = {
          x: width * 0.2,
          y: floorY + 6,
          scale: Math.max(0.78, Math.min(1.15, width / 1180))
        };
        drawRestingTargetBook(targetBook, targetBookLayout.x, targetBookLayout.y, targetBookLayout.scale);

        const guideHotspot = hotspots.find((item) => item.id === "guide")!.draw;
        guideHotspot.clear();
        guideHotspot.roundRect(width * 0.5 - 120, floorY - 230, 240, 250, 24).fill({ color: 0xffffff, alpha: 0.001 });

        const targetHotspot = hotspots.find((item) => item.id === "targets")!.draw;
        targetHotspot.clear();
        targetHotspot
          .roundRect(targetBookLayout.x - 96, targetBookLayout.y - 84, 192, 116, 14)
          .fill({ color: 0xd8c692, alpha: 0.035 });

        const historyHotspot = hotspots.find((item) => item.id === "history")!.draw;
        historyHotspot.clear();
        historyHotspot.roundRect(width * 0.61, height * 0.7, 150, 92, 10).fill({ color: 0xd8c692, alpha: 0.045 });

        const settingsHotspot = hotspots.find((item) => item.id === "settings")!.draw;
        settingsHotspot.clear();
        settingsHotspot.roundRect(width * 0.82, height * 0.5, 90, 160, 10).fill({ color: 0xd8c692, alpha: 0.045 });
      }

      app.ticker.add((ticker) => {
        elapsed += ticker.deltaTime / 60;

        const width = app.renderer.width;
        const height = app.renderer.height;
        const runtime = runtimeRef.current;
        if (width !== lastWidth || height !== lastHeight) {
          redraw();
          lastWidth = width;
          lastHeight = height;
        }

        if (runtime.sceneViewModel.targetBookMode !== desiredTargetBookMode) {
          desiredTargetBookMode = runtime.sceneViewModel.targetBookMode;
          bookClipQueue = targetBookTransition(settledTargetBookMode, desiredTargetBookMode);
          activeBookClip = bookClipQueue.shift() ?? null;
          bookClipStartedAt = elapsed;
          if (activeBookClip && guideBookClips[activeBookClip].loops && bookClipQueue.length === 0) {
            settledTargetBookMode = desiredTargetBookMode;
          }
        }

        let activeBookProgress = activeBookClip ? Math.min(1, (elapsed - bookClipStartedAt) / bookClipDurations[activeBookClip]) : 1;
        if (activeBookClip && activeBookProgress >= 1 && (!guideBookClips[activeBookClip].loops || bookClipQueue.length > 0)) {
          activeBookClip = bookClipQueue.shift() ?? null;
          bookClipStartedAt = elapsed;
          activeBookProgress = 0;
          if (activeBookClip && guideBookClips[activeBookClip].loops && bookClipQueue.length === 0) {
            settledTargetBookMode = desiredTargetBookMode;
          }
          if (!activeBookClip) {
            settledTargetBookMode = desiredTargetBookMode;
          }
        }

        const guideIntent = activeBookClip ?? runtime.sceneViewModel.guideIntent;
        const renderedGuideClip = guideClipForIntent(guideIntent, runtime.guideState);
        const independentBookState = activeBookClip
          ? independentBookStateForClip(activeBookClip, activeBookProgress)
          : runtime.sceneViewModel.independentBookState;
        targetBook.visible = independentBookState === "visible";
        hotspots.find((item) => item.id === "targets")!.draw.visible = targetBook.visible;
        if (targetBookLabel) {
          targetBookLabel.visible = targetBook.visible;
        }

        const floorY = height * 0.78;
        const breath = Math.sin(elapsed * 1.6) * 4;
        guide.y = floorY + 10 + breath;
        guide.alpha = runtime.stimulationRunning ? 0.3 : runtime.mode === "idle" ? 0.92 : 1;
        if (renderedGuideClip !== currentGuideClip) {
          currentGuideClip = renderedGuideClip;
          guide.textures = guideFrames[renderedGuideClip];
          guide.gotoAndPlay(0);
        }

        for (const firefly of fireflies) {
          const x = (Math.sin(elapsed * firefly.speed + firefly.xSeed) * 0.5 + 0.5) * width;
          const y = height * 0.22 + (Math.cos(elapsed * firefly.speed + firefly.ySeed) * 0.5 + 0.5) * height * 0.42;
          firefly.dot.clear();
          firefly.dot.circle(x, y, 1.5 + (firefly.index % 3)).fill({ color: "#d8c692", alpha: 0.16 });
          firefly.dot.alpha = runtime.stimulationRunning ? 0.25 : 1;
        }

        dimmer.clear();
        if (runtime.stimulationRunning) {
          dimmer.rect(0, 0, width, height).fill({ color: 0x050505, alpha: 0.58 });
        }

        orb.visible = runtime.stimulationRunning;
        if (runtime.stimulationRunning) {
          const travel = width * 0.64;
          const centerX = width * 0.5;
          const x = centerX + Math.sin(elapsed * 1.55 * runtime.stimulationSpeed) * travel * 0.5;
          orb.position.set(x, height * 0.36);
          orb.width = 70;
          orb.height = 70;
          orb.tint = runtime.stimulationColor;
        }
      });
    }

    void mount(host);

    return () => {
      disposed = true;
      app.destroy(true, { children: true, texture: false });
    };
  }, []);

  return <div ref={hostRef} className="roomScene" />;
}

function createGuideFrames(
  frames: Texture[],
  bookFrames: Record<GuideBookIntent, Texture[]>
): Record<GuideClipKey, Texture[]> {
  return {
    idle: guideStateFrames.idle.map((frameIndex) => frames[frameIndex]),
    listening: guideStateFrames.listening.map((frameIndex) => frames[frameIndex]),
    speaking: guideStateFrames.speaking.map((frameIndex) => frames[frameIndex]),
    thinking: guideStateFrames.thinking.map((frameIndex) => frames[frameIndex]),
    ...bookFrames
  };
}

async function loadGuideBookTextures(): Promise<Record<GuideBookIntent, Texture[]>> {
  const entries = await Promise.all(
    Object.entries(guideBookFrameNames).map(async ([intent, frameNames]) => [
      intent,
      await Promise.all(frameNames.map((frameName) => Assets.load<Texture>(guideBookFrameUrl(frameName))))
    ])
  );

  return Object.fromEntries(entries) as Record<GuideBookIntent, Texture[]>;
}

function guideBookFrameUrl(frameName: string) {
  const key = `../../assets/animated-room/${frameName}`;
  const url = guideBookFrameModules[key];
  if (!url) {
    throw new Error(`Missing guide book frame: ${frameName}`);
  }
  return url;
}

function drawRestingTargetBook(book: Container, x: number, y: number, scale: number) {
  book.removeChildren();
  book.position.set(x, y);
  book.scale.set(scale);

  const shadow = new Graphics();
  shadow.ellipse(0, 2, 76, 18).fill({ color: 0x080706, alpha: 0.36 });

  const cover = new Graphics();
  cover.roundRect(-70, -58, 140, 92, 9).fill(0x4b1823);
  cover.roundRect(-62, -50, 124, 76, 6).stroke({ color: 0x9b6a45, width: 2, alpha: 0.74 });
  cover.roundRect(-60, -48, 120, 72, 5).fill({ color: 0x5c202a, alpha: 0.72 });
  cover.rect(-55, -46, 12, 68).fill({ color: 0x2f0e16, alpha: 0.82 });
  cover.moveTo(-24, -36).lineTo(44, -36).stroke({ color: 0xb78a55, width: 1.5, alpha: 0.48 });
  cover.moveTo(-24, -18).lineTo(38, -18).stroke({ color: 0xb78a55, width: 1.5, alpha: 0.4 });
  cover.moveTo(-24, 0).lineTo(44, 0).stroke({ color: 0xb78a55, width: 1.5, alpha: 0.34 });

  book.addChild(shadow, cover);
}

function guideClipForIntent(intent: GuideIntent, fallback: GuideState): GuideClipKey {
  if (!isGuideBookIntent(intent)) return fallback;
  return intent;
}

function isGuideBookIntent(intent: GuideIntent): intent is GuideBookIntent {
  return Object.prototype.hasOwnProperty.call(guideBookClips, intent);
}
