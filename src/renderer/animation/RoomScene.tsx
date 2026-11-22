import { useEffect, useRef } from "react";
import { Application, Assets, ColorMatrixFilter, Container, Rectangle, Sprite, Text, Texture } from "pixi.js";
import type { GuideAction, GuideAnimationIntent } from "./guideAnimationModel";
import { GuideCharacter } from "./guideCharacter";
import roomUrl from "../../../assets/animated-room/painted/room.jpg?url";
import orbUrl from "../../../assets/animated-room/painted/orb.jpg?url";
import { orbAngularSpeed, orbDiameter, pathLift, type StimulationPath } from "./stimulationStyle";
import { coverTransform, rectToScreen, roomRegions, toScreen, type ArtRect } from "./paintedRoom";

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
  onStimulationCycle,
  onStimulationBeat
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
  /** Fires each time the light reaches a side, for audio bilateral stimulation. */
  onStimulationBeat?: (side: "left" | "right") => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onObjectSelected);
  const actionCompleteRef = useRef(onGuideActionComplete);
  const cycleRef = useRef(onStimulationCycle);
  const beatRef = useRef(onStimulationBeat);
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
  beatRef.current = onStimulationBeat;
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

      // Everything visible is a generated painting; nothing is drawn with vector graphics.
      const roomTexture = await Assets.load<Texture>(roomUrl);
      const orbTexture = await Assets.load<Texture>(orbUrl);
      const guideCharacter = await GuideCharacter.load({
        onTargetBookSelected: () => callbackRef.current("targets"),
        onActionComplete: (action) => actionCompleteRef.current(action)
      });

      const cropTexture = (rect: ArtRect) =>
        new Texture({ source: roomTexture.source, frame: new Rectangle(rect.x, rect.y, rect.width, rect.height) });

      const scene = new Container();
      const painting = new Sprite(roomTexture);
      const lantern = new Sprite(cropTexture(roomRegions.lantern));
      const lanternWindow = new Sprite(cropTexture(roomRegions.lanternWindow));
      lanternWindow.blendMode = "add";
      const chest = new Sprite(cropTexture(roomRegions.chest));
      scene.addChild(painting, lantern, chest, lanternWindow);

      // During a set the scene recedes so the light is the only thing that holds attention.
      const dim = new ColorMatrixFilter();
      dim.brightness(0.42, false);

      const orb = new Sprite(orbTexture);
      orb.anchor.set(0.5);
      orb.blendMode = "add";
      orb.visible = false;

      const hoverLabel = new Text({
        text: "",
        style: {
          fill: "#efe7d4",
          fontSize: 14,
          fontFamily: "Inter, system-ui, sans-serif",
          letterSpacing: 0.4,
          dropShadow: { color: "#000000", alpha: 0.7, blur: 6, distance: 0 }
        }
      });
      hoverLabel.anchor.set(0.5, 1);
      hoverLabel.visible = false;

      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");

      type Hotspot = { id: RoomObjectId; label: string; target: Container; highlight?: Sprite };
      const guideHit = new Container();
      const bookHit = new Container();
      const hotspots: Hotspot[] = [
        { id: "guide", label: "Guide", target: guideHit },
        { id: "targets", label: "Targets", target: bookHit },
        { id: "history", label: "History", target: chest, highlight: chest },
        { id: "settings", label: "Settings", target: lantern, highlight: lantern }
      ];
      const highlight = new ColorMatrixFilter();
      highlight.brightness(1.3, false);
      let hovered: Hotspot | null = null;

      for (const hotspot of hotspots) {
        hotspot.target.eventMode = "static";
        hotspot.target.cursor = "pointer";
        hotspot.target.on("pointertap", (event) => {
          event.stopPropagation();
          callbackRef.current(hotspot.id);
        });
        hotspot.target.on("pointerover", () => {
          hovered = hotspot;
        });
        hotspot.target.on("pointerout", () => {
          if (hovered === hotspot) hovered = null;
        });
      }

      const world = new Container();
      world.addChild(scene, guideCharacter.container);
      stage.addChild(world, guideHit, bookHit, orb, hoverLabel);

      let elapsed = 0;
      let lastWidth = 0;
      let lastHeight = 0;
      let wasRunning = false;
      let phase = 0;
      let reportedCycles = 0;
      let reportedBeats = 0;
      let stimulationY = 0;

      function placeSprite(sprite: Sprite, transform: ReturnType<typeof coverTransform>, rect: ArtRect) {
        const screen = rectToScreen(transform, rect);
        sprite.position.set(screen.x, screen.y);
        sprite.width = screen.width;
        sprite.height = screen.height;
      }

      function layout() {
        const width = app.renderer.width;
        const height = app.renderer.height;
        const transform = coverTransform(width, height);

        painting.position.set(transform.offsetX, transform.offsetY);
        painting.scale.set(transform.scale);
        placeSprite(lantern, transform, roomRegions.lantern);
        placeSprite(chest, transform, roomRegions.chest);
        placeSprite(lanternWindow, transform, roomRegions.lanternWindow);

        const baseline = toScreen(transform, roomRegions.guideBaseline);
        const guideSize = roomRegions.guideSize * transform.scale;
        guideCharacter.layout({ x: baseline.x, baselineY: baseline.y, size: guideSize });
        guideHit.hitArea = new Rectangle(baseline.x - guideSize * 0.3, baseline.y - guideSize * 0.95, guideSize * 0.6, guideSize * 0.95);

        stimulationY = toScreen(transform, { x: 0, y: roomRegions.stimulationY }).y;
      }

      function syncBookHotspot() {
        const bounds = guideCharacter.getTargetBookBounds();
        bookHit.hitArea = new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
        bookHit.visible = bounds.visible;
      }

      function syncHover(running: boolean) {
        lantern.filters = null;
        chest.filters = null;
        const hotspot = !running && hovered && hovered.target.visible ? hovered : null;
        if (!hotspot) {
          hoverLabel.visible = false;
          return;
        }
        if (hotspot.highlight) hotspot.highlight.filters = [highlight];
        const bounds = hotspot.target.hitArea instanceof Rectangle ? hotspot.target.hitArea : hotspot.target.getBounds();
        hoverLabel.text = hotspot.label;
        hoverLabel.position.set(bounds.x + bounds.width / 2, bounds.y - 6);
        hoverLabel.visible = true;
      }

      app.ticker.add((ticker) => {
        const deltaSeconds = ticker.deltaMS / 1000;
        if (!reducedMotion?.matches) elapsed += deltaSeconds;

        const width = app.renderer.width;
        const height = app.renderer.height;
        const runtime = runtimeRef.current;
        if (width !== lastWidth || height !== lastHeight) {
          layout();
          lastWidth = width;
          lastHeight = height;
        }

        guideCharacter.sync(runtime.guideAnimation);
        guideCharacter.syncTargetBookVisibility();
        guideCharacter.setFrame({
          alpha: runtime.stimulationRunning ? 0.6 : runtime.mode === "idle" ? 0.95 : 1
        });
        syncBookHotspot();
        syncHover(runtime.stimulationRunning);

        // The painted lantern window breathes a little, as a flame would.
        lanternWindow.alpha = 0.22 + Math.sin(elapsed * 6.1) * 0.06 + Math.sin(elapsed * 2.3 + 1.3) * 0.08;
        world.filters = runtime.stimulationRunning ? [dim] : null;

        if (runtime.stimulationRunning && !wasRunning) {
          phase = 0;
          reportedCycles = 0;
          reportedBeats = 0;
          cycleRef.current(0);
          beatRef.current?.("left");
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
          // The painted glow fills about a third of its image; size the sprite so the glow matches the setting.
          const diameter = (orbDiameter[runtime.stimulationSize] ?? orbDiameter.medium) * 2.8;
          orb.position.set(x, stimulationY + lift);
          orb.width = diameter;
          orb.height = diameter;
          orb.tint = runtime.stimulationColor;

          // The light reaches the right side at odd multiples of π and the left at even ones.
          const beats = Math.floor(phase / Math.PI);
          if (beats !== reportedBeats) {
            reportedBeats = beats;
            beatRef.current?.(beats % 2 === 1 ? "right" : "left");
          }

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
