import { useEffect, useRef } from "react";
import { Application, Assets, Container, Graphics, Sprite, Text } from "pixi.js";
import type { GuideAction, GuideAnimationIntent } from "./guideAnimationModel";
import { GuideCharacter } from "./guideCharacter";
import orbUrl from "../../../assets/animated-room/orb.svg?url";
import { orbAngularSpeed, orbDiameter } from "./stimulationStyle";

export type RoomObjectId = "guide" | "targets" | "history" | "settings";

type RoomMode = "idle" | "chat" | "session" | "stimulation";


export function RoomScene({
  mode,
  guideAnimation,
  stimulationRunning,
  stimulationColor,
  stimulationSpeed,
  stimulationSize,
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
    stimulationSize
  });
  callbackRef.current = onObjectSelected;
  actionCompleteRef.current = onGuideActionComplete;
  cycleRef.current = onStimulationCycle;
  runtimeRef.current = { mode, guideAnimation, stimulationRunning, stimulationColor, stimulationSpeed, stimulationSize };

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
      const fireflies = Array.from({ length: 18 }, (_, index) => ({
        xSeed: Math.random() * 1000,
        ySeed: Math.random() * 1000,
        speed: 0.35 + Math.random() * 0.75,
        dot: new Graphics(),
        index
      }));

      orb.anchor.set(0.5);
      orb.visible = false;
      stage.addChild(background, moon, hoverGlow, hill, guideCharacter.container);
      for (const firefly of fireflies) {
        stage.addChild(firefly.dot);
      }
      stage.addChild(dimmer, orb, hoverLabel);

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
        hill.roundRect(settingsX - 40, settingsY - 4, 80, 120, 8).fill("#383229");
        hill.roundRect(settingsX - 30, settingsY + 52, 60, 62, 8).fill("#40372d");
        hill.circle(settingsX, settingsY + 18, 31).fill("#5a4a32");
        hill.circle(settingsX - 8, settingsY + 10, 20).fill({ color: "#d8c692", alpha: 0.08 });
        hill.ellipse(historyX, historyY + 32, 72, 16).fill({ color: "#080807", alpha: 0.2 });
        hill.roundRect(historyX - 54, historyY - 18, 108, 58, 8).fill("#3f2f27");
        hill.roundRect(historyX - 48, historyY - 13, 96, 48, 5).fill("#4a382e");
        hill.rect(historyX - 48, historyY - 3, 96, 5).fill({ color: "#d8c692", alpha: 0.14 });
        hill.rect(historyX - 36, historyY + 12, 66, 4).fill({ color: "#d8c692", alpha: 0.12 });

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
          const x = width * 0.5 - Math.cos(phase) * travel * 0.5;
          const diameter = orbDiameter[runtime.stimulationSize] ?? orbDiameter.medium;
          orb.position.set(x, height * 0.36);
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
