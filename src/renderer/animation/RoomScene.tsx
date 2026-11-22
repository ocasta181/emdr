import { useEffect, useRef } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text } from "pixi.js";
import type { GuideAction, GuideAnimationIntent } from "./guideAnimationModel";
import { GuideCharacter } from "./guideCharacter";
import orbUrl from "../../../assets/animated-room/orb.svg?url";
import { orbAngularSpeed, orbDiameter, pathLift, type StimulationPath } from "./stimulationStyle";
import {
  createFireflies,
  createStarField,
  drawChest,
  drawFireflies,
  drawGround,
  drawLantern,
  drawLanternGlow,
  drawMist,
  drawMoon,
  drawMountains,
  drawSky,
  drawStars,
  drawVignette,
  flickerLantern,
  roomLayout,
  twinkleStars
} from "./roomBackdrop";

export type RoomObjectId = "guide" | "targets" | "history" | "settings";

type RoomMode = "idle" | "chat" | "session" | "stimulation";


export function RoomScene({
  mode,
  guideAnimation,
  stimulationRunning,
  stimulationColor,
  stimulationSpeed,
  stimulationSize,
  stimulationPath,
  onObjectSelected,
  onGuideActionComplete,
  onStimulationCycle
}: {
  mode: RoomMode;
  guideAnimation: GuideAnimationIntent;
  stimulationRunning: boolean;
  stimulationColor: string;
  stimulationSpeed: number;
  stimulationSize: keyof typeof orbDiameter;
  stimulationPath: StimulationPath;
  onObjectSelected: (objectId: RoomObjectId) => void;
  onGuideActionComplete: (action: GuideAction) => void;
  onStimulationCycle: (cycleCount: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onObjectSelected);
  const actionCompleteRef = useRef(onGuideActionComplete);
  const cycleRef = useRef(onStimulationCycle);
  const runtimeRef = useRef({
    mode,
    guideAnimation,
    stimulationRunning,
    stimulationColor,
    stimulationSpeed,
    stimulationSize,
    stimulationPath
  });
  callbackRef.current = onObjectSelected;
  actionCompleteRef.current = onGuideActionComplete;
  cycleRef.current = onStimulationCycle;
  runtimeRef.current = {
    mode,
    guideAnimation,
    stimulationRunning,
    stimulationColor,
    stimulationSpeed,
    stimulationSize,
    stimulationPath
  };

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

      const sky = new Graphics();
      const stars = createStarField(110);
      const moon = new Graphics();
      const mountains = new Graphics();
      const mist = new Graphics();
      const ground = new Graphics();
      const lantern = new Graphics();
      const lanternGlow = new Graphics();
      lanternGlow.blendMode = "add";
      const chest = new Graphics();
      const vignette = new Graphics();
      const hoverGlow = new Graphics();
      const hoverLabel = new Text({
        text: "",
        style: { fill: "#efe7d4", fontSize: 14, fontFamily: "Inter, system-ui, sans-serif", letterSpacing: 0.4 }
      });
      hoverLabel.anchor.set(0.5, 1);
      hoverLabel.visible = false;
      const orbTexture = await Assets.load(orbUrl);
      const guideCharacter = await GuideCharacter.load({
        onTargetBookSelected: () => callbackRef.current("targets"),
        onActionComplete: (action) => actionCompleteRef.current(action)
      });
      const orb = new Sprite(orbTexture);
      const dimmer = new Graphics();
      const fireflies = createFireflies(16);
      // Ambient motion (stars, mist, fireflies, flame) holds still for people who prefer reduced motion.
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

      orb.anchor.set(0.5);
      orb.visible = false;
      stage.addChild(sky, ...stars.groups, moon, mountains, mist, ground, chest, lantern, lanternGlow, hoverGlow, guideCharacter.container);
      for (const firefly of fireflies) {
        stage.addChild(firefly.dot);
      }
      stage.addChild(vignette, dimmer, orb, hoverLabel);

      type Hotspot = {
        id: RoomObjectId;
        label: string;
        draw: Graphics;
        anchor: { x: number; y: number; rx: number; ry: number };
      };

      const hotspots: Hotspot[] = [
        { id: "guide", label: "Guide", draw: new Graphics(), anchor: { x: 0, y: 0, rx: 0, ry: 0 } },
        { id: "targets", label: "Targets", draw: new Graphics(), anchor: { x: 0, y: 0, rx: 0, ry: 0 } },
        { id: "history", label: "History", draw: new Graphics(), anchor: { x: 0, y: 0, rx: 0, ry: 0 } },
        { id: "settings", label: "Settings", draw: new Graphics(), anchor: { x: 0, y: 0, rx: 0, ry: 0 } }
      ];
      let hovered: RoomObjectId | null = null;

      for (const hotspot of hotspots) {
        hotspot.draw.eventMode = "static";
        hotspot.draw.cursor = "pointer";
        hotspot.draw.on("pointertap", (event) => {
          event.stopPropagation();
          callbackRef.current(hotspot.id);
        });
        hotspot.draw.on("pointerover", () => {
          hovered = hotspot.id;
        });
        hotspot.draw.on("pointerout", () => {
          if (hovered === hotspot.id) hovered = null;
        });
        stage.addChild(hotspot.draw);
      }

      let elapsed = 0;
      let ambientTime = 0;
      let lastWidth = 0;
      let lastHeight = 0;
      let wasRunning = false;
      let phase = 0;
      let reportedCycles = 0;

      function redraw() {
        const width = app.renderer.width;
        const height = app.renderer.height;
        const floorY = height * 0.78;
        const historyX = width * 0.68;
        const historyY = height * 0.78;
        const settingsX = width * 0.84;
        const settingsY = height * 0.56;

        const layout = roomLayout(width, height);
        drawSky(sky, layout);
        drawStars(stars, layout);
        drawMoon(moon, layout);
        drawMountains(mountains, layout);
        drawMist(mist, layout);
        drawGround(ground, layout);
        drawChest(chest, layout);
        drawLantern(lantern, layout);
        drawLanternGlow(lanternGlow, layout);
        drawVignette(vignette, layout);

        guideCharacter.layout({
          x: width * 0.5,
          baselineY: floorY + 10,
          size: Math.min(260, width * 0.23)
        });

        const byId = (id: RoomObjectId) => hotspots.find((item) => item.id === id)!;

        const guideHotspot = byId("guide");
        guideHotspot.draw.clear();
        guideHotspot.draw.roundRect(width * 0.5 - 40, floorY - 230, 160, 250, 24).fill({ color: 0xffffff, alpha: 0.001 });
        guideHotspot.anchor = { x: width * 0.5, y: floorY - 90, rx: 120, ry: 140 };

        const historyHotspot = byId("history");
        historyHotspot.draw.clear();
        historyHotspot.draw.roundRect(historyX - 70, historyY - 34, 140, 92, 10).fill({ color: 0xffffff, alpha: 0.001 });
        historyHotspot.anchor = { x: historyX, y: historyY + 11, rx: 96, ry: 54 };

        const settingsHotspot = byId("settings");
        settingsHotspot.draw.clear();
        settingsHotspot.draw.roundRect(settingsX - 52, settingsY - 14, 104, 142, 10).fill({ color: 0xffffff, alpha: 0.001 });
        settingsHotspot.anchor = { x: settingsX, y: settingsY + 40, rx: 76, ry: 92 };
      }

      function syncTargetHotspot() {
        const targetHotspot = hotspots.find((item) => item.id === "targets")!;
        const bounds = guideCharacter.getTargetBookBounds();
        targetHotspot.draw.clear();
        targetHotspot.draw
          .roundRect(bounds.x, bounds.y, bounds.width, bounds.height, 12)
          .fill({ color: 0xffffff, alpha: 0.001 });
        targetHotspot.draw.visible = bounds.visible;
        targetHotspot.anchor = {
          x: bounds.x + bounds.width / 2,
          y: bounds.y + bounds.height / 2,
          rx: bounds.width * 0.9,
          ry: bounds.height * 0.9
        };
      }

      function drawHover(running: boolean) {
        hoverGlow.clear();
        const hotspot = !running && hovered ? hotspots.find((item) => item.id === hovered) : undefined;
        if (!hotspot || !hotspot.draw.visible) {
          hoverLabel.visible = false;
          return;
        }
        const { x, y, rx, ry } = hotspot.anchor;
        const pulse = 0.5 + Math.sin(elapsed * 2.4) * 0.5;
        hoverGlow.ellipse(x, y, rx, ry).fill({ color: "#d8c692", alpha: 0.05 + pulse * 0.03 });
        hoverGlow.ellipse(x, y, rx * 0.7, ry * 0.7).fill({ color: "#d8c692", alpha: 0.05 + pulse * 0.03 });
        hoverLabel.text = hotspot.label;
        hoverLabel.position.set(x, y - ry - 6);
        hoverLabel.visible = true;
      }

      app.ticker.add((ticker) => {
        const deltaSeconds = ticker.deltaMS / 1000;
        elapsed += deltaSeconds;
        if (!reducedMotion?.matches) ambientTime += deltaSeconds;

        const width = app.renderer.width;
        const height = app.renderer.height;
        const runtime = runtimeRef.current;
        if (width !== lastWidth || height !== lastHeight) {
          redraw();
          lastWidth = width;
          lastHeight = height;
        }

        guideCharacter.sync(runtime.guideAnimation);
        guideCharacter.syncTargetBookVisibility();
        guideCharacter.setFrame({
          alpha: runtime.stimulationRunning ? 0.3 : runtime.mode === "idle" ? 0.92 : 1
        });
        syncTargetHotspot();
        drawHover(runtime.stimulationRunning);

        twinkleStars(stars, ambientTime);
        flickerLantern(lanternGlow, ambientTime);
        mist.x = Math.sin(ambientTime * 0.05) * width * 0.04;
        drawFireflies(fireflies, roomLayout(width, height), ambientTime);
        const ambientAlpha = runtime.stimulationRunning ? 0.25 : 1;
        for (const firefly of fireflies) firefly.dot.alpha = ambientAlpha;

        dimmer.clear();
        if (runtime.stimulationRunning) {
          dimmer.rect(0, 0, width, height).fill({ color: 0x050505, alpha: 0.58 });
        }

        if (runtime.stimulationRunning && !wasRunning) {
          phase = 0;
          reportedCycles = 0;
          cycleRef.current(0);
        }
        wasRunning = runtime.stimulationRunning;

        orb.visible = runtime.stimulationRunning;
        if (runtime.stimulationRunning) {
          // Phase accumulates so speed changes mid-set never make the orb jump.
          phase += deltaSeconds * orbAngularSpeed * runtime.stimulationSpeed;
          const travel = width * 0.64;
          const dx = -Math.cos(phase);
          const x = width * 0.5 + dx * travel * 0.5;
          const lift = pathLift(runtime.stimulationPath, dx) * height * 0.09;
          const diameter = orbDiameter[runtime.stimulationSize] ?? orbDiameter.medium;
          orb.position.set(x, height * 0.36 + lift);
          orb.width = diameter;
          orb.height = diameter;
          orb.tint = runtime.stimulationColor;

          const cycles = Math.floor(phase / (Math.PI * 2));
          if (cycles !== reportedCycles) {
            reportedCycles = cycles;
            cycleRef.current(cycles);
          }
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
