import { useEffect, useRef } from "react";
import { AnimatedSprite, Application, Assets, Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import {
  guideAnimationForScene,
  independentBookStateForPose,
  independentBookStateForTransition,
  planGuidePoseTransitions,
  type DesiredGuideAnimation,
  type GuideBookAction,
  type GuidePose,
  type GuideSpriteClip,
  type GuideTransitionStep,
  type SceneViewModel
} from "./guideSceneModel";
import { createGuideSpriteSheet, guideSpriteCellSize, guideSpriteFrameRate } from "./guideSpriteSheet";
import guideSpriteSheetUrl from "../../assets/animated-room/guide-sprite-sheet-154.png?url";
import orbUrl from "../../assets/animated-room/orb.svg?url";

export type RoomObjectId = "guide" | "targets" | "history" | "settings";

type RoomMode = "idle" | "chat" | "session" | "stimulation";

export function RoomScene({
  mode,
  sceneViewModel,
  stimulationRunning,
  stimulationColor,
  stimulationSpeed,
  onObjectSelected
}: {
  mode: RoomMode;
  sceneViewModel: SceneViewModel;
  stimulationRunning: boolean;
  stimulationColor: string;
  stimulationSpeed: number;
  onObjectSelected: (objectId: RoomObjectId) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onObjectSelected);
  const runtimeRef = useRef({ mode, sceneViewModel, stimulationRunning, stimulationColor, stimulationSpeed });
  callbackRef.current = onObjectSelected;
  runtimeRef.current = { mode, sceneViewModel, stimulationRunning, stimulationColor, stimulationSpeed };

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
      const guideSheetTexture = await Assets.load<Texture>(guideSpriteSheetUrl);
      const orbTexture = await Assets.load(orbUrl);
      const guideSheet = createGuideSpriteSheet(guideSheetTexture);
      const guide = new AnimatedSprite(guideSheet.clips.idle);
      const targetBook = new Sprite(guideSheet.bookAtRest);
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
      guide.animationSpeed = guideSpriteFrameRate / 60;
      guide.loop = true;
      guide.play();
      targetBook.anchor.set(0.5, 1);
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
      let activeClipKey = "";
      let currentPose: GuidePose = "idle";
      let activeTransition: GuideTransitionStep | null = null;
      let activeAction: GuideBookAction | null = null;
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

        guide.position.set(width * 0.5, floorY + 10);
        guide.width = Math.min(260, width * 0.23);
        guide.height = guide.width;
        targetBookLayout = {
          x: guide.x - guide.width * 0.55,
          y: guide.y,
          scale: guide.width / guideSpriteCellSize
        };
        targetBook.position.set(targetBookLayout.x, targetBookLayout.y);
        targetBook.width = guideSpriteCellSize * targetBookLayout.scale;
        targetBook.height = guideSpriteCellSize * targetBookLayout.scale;

        labels.removeChildren();
        targetBookLabel = drawLabel("Target book", targetBookLayout.x, targetBookLayout.y + 34);
        drawLabel("Settings", width * 0.82 + 40, height * 0.73);
        drawLabel("History", width * 0.68, height * 0.82);

        const guideHotspot = hotspots.find((item) => item.id === "guide")!.draw;
        guideHotspot.clear();
        guideHotspot.roundRect(width * 0.5 - 120, floorY - 230, 240, 250, 24).fill({ color: 0xffffff, alpha: 0.001 });

        const targetHotspot = hotspots.find((item) => item.id === "targets")!.draw;
        targetHotspot.clear();
        targetHotspot
          .roundRect(targetBookLayout.x - 72, targetBookLayout.y - 78, 144, 108, 14)
          .fill({ color: 0xd8c692, alpha: 0.035 });

        const historyHotspot = hotspots.find((item) => item.id === "history")!.draw;
        historyHotspot.clear();
        historyHotspot.roundRect(width * 0.61, height * 0.7, 150, 92, 10).fill({ color: 0xd8c692, alpha: 0.045 });

        const settingsHotspot = hotspots.find((item) => item.id === "settings")!.draw;
        settingsHotspot.clear();
        settingsHotspot.roundRect(width * 0.82, height * 0.5, 90, 160, 10).fill({ color: 0xd8c692, alpha: 0.045 });
      }

      function syncGuideAnimation(desired: DesiredGuideAnimation) {
        if (activeTransition) return;

        if (currentPose !== desired.pose) {
          activeAction = null;
          const [nextTransition] = planGuidePoseTransitions(currentPose, desired.pose);
          if (nextTransition) {
            activeTransition = nextTransition;
            playGuideClip(nextTransition.clip, {
              reverse: nextTransition.reverse,
              loop: false,
              onComplete: () => {
                currentPose = nextTransition.to;
                activeTransition = null;
                syncGuideAnimation(guideAnimationForScene(runtimeRef.current.sceneViewModel));
              }
            });
            return;
          }

          currentPose = desired.pose;
        }

        if (desired.action) {
          if (activeAction !== desired.action) {
            activeAction = desired.action;
            playGuideClip(desired.action, { loop: true });
          }
          return;
        }

        activeAction = null;
        playGuideClip(currentPose, { loop: true });
      }

      function playGuideClip(
        clip: GuideSpriteClip,
        options: { reverse?: boolean; loop: boolean; onComplete?: () => void }
      ) {
        const clipKey = `${clip}:${options.reverse ? "reverse" : "forward"}:${options.loop ? "loop" : "once"}`;
        if (clipKey === activeClipKey) return;

        activeClipKey = clipKey;
        guide.textures = options.reverse ? guideSheet.clips[clip].slice().reverse() : guideSheet.clips[clip];
        guide.loop = options.loop;
        guide.animationSpeed = guideSpriteFrameRate / 60;
        guide.onComplete = options.onComplete ?? undefined;
        guide.gotoAndPlay(0);
      }

      function syncTargetBookVisibility() {
        const independentBookState = activeTransition
          ? independentBookStateForTransition(activeTransition, activeTransitionProgress())
          : independentBookStateForPose(currentPose);
        targetBook.visible = independentBookState === "visible";
        hotspots.find((item) => item.id === "targets")!.draw.visible = targetBook.visible;
        if (targetBookLabel) {
          targetBookLabel.visible = targetBook.visible;
        }
      }

      function activeTransitionProgress() {
        const frameCount = guide.textures.length;
        if (frameCount <= 1) return 1;
        return guide.currentFrame / (frameCount - 1);
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

        syncGuideAnimation(guideAnimationForScene(runtime.sceneViewModel));
        syncTargetBookVisibility();

        const floorY = height * 0.78;
        const breath = Math.sin(elapsed * 1.6) * 4;
        guide.y = floorY + 10 + breath;
        guide.alpha = runtime.stimulationRunning ? 0.3 : runtime.mode === "idle" ? 0.92 : 1;

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
