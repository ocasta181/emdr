import { FillGradient, Graphics } from "pixi.js";

/**
 * Procedural scenery for the room: a moonlit overlook with a stone terrace, a lantern (settings)
 * and a chest (history). Everything is drawn from the current canvas size so it stays crisp on resize.
 * Static layers are drawn on resize; the few animated layers expose cheap per-frame updates.
 */

export type RoomLayout = {
  width: number;
  height: number;
  horizonY: number;
  floorY: number;
  lantern: { x: number; y: number };
  chest: { x: number; y: number };
  moon: { x: number; y: number; r: number };
};

export function roomLayout(width: number, height: number): RoomLayout {
  return {
    width,
    height,
    horizonY: height * 0.6,
    floorY: height * 0.78,
    lantern: { x: width * 0.84, y: height * 0.56 },
    chest: { x: width * 0.68, y: height * 0.78 },
    moon: { x: width * 0.78, y: height * 0.19, r: Math.max(34, width * 0.034) }
  };
}

function vertical(stops: Array<[number, string]>) {
  return new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
    textureSpace: "local"
  });
}

function radial(stops: Array<[number, string]>) {
  return new FillGradient({
    type: "radial",
    center: { x: 0.5, y: 0.5 },
    innerRadius: 0,
    outerCenter: { x: 0.5, y: 0.5 },
    outerRadius: 0.5,
    colorStops: stops.map(([offset, color]) => ({ offset, color })),
    textureSpace: "local"
  });
}

export function drawSky(g: Graphics, layout: RoomLayout) {
  const { width, height, horizonY } = layout;
  g.clear();
  g.rect(0, 0, width, horizonY + 4).fill(
    vertical([
      [0, "#0d1420"],
      [0.45, "#18273a"],
      [0.82, "#2c3b48"],
      [1, "#4a4a46"]
    ])
  );
  // Warm haze low on the horizon.
  g.ellipse(width * 0.5, horizonY, width * 0.7, height * 0.12).fill(
    radial([
      [0, "rgba(216, 180, 130, 0.16)"],
      [1, "rgba(216, 180, 130, 0)"]
    ])
  );
}

export type StarField = { groups: Graphics[]; seeds: number[] };

export function createStarField(count: number): StarField {
  const groups = [new Graphics(), new Graphics(), new Graphics()];
  const seeds = Array.from({ length: count * 3 }, () => Math.random());
  return { groups, seeds };
}

export function drawStars(field: StarField, layout: RoomLayout) {
  const { width, horizonY, moon } = layout;
  field.groups.forEach((group) => group.clear());
  const count = field.seeds.length / 3;
  for (let index = 0; index < count; index += 1) {
    const x = field.seeds[index * 3] * width;
    // Bias stars toward the top of the sky.
    const y = Math.pow(field.seeds[index * 3 + 1], 1.6) * horizonY * 0.92;
    if (Math.hypot(x - moon.x, y - moon.y) < moon.r * 2.2) continue;
    const size = 0.6 + field.seeds[index * 3 + 2] * 1.3;
    const group = field.groups[index % field.groups.length];
    group.circle(x, y, size).fill({ color: "#f2ecd9", alpha: 0.35 + field.seeds[index * 3 + 2] * 0.5 });
  }
}

export function twinkleStars(field: StarField, time: number) {
  field.groups.forEach((group, index) => {
    group.alpha = 0.62 + Math.sin(time * (0.7 + index * 0.35) + index * 2.1) * 0.3;
  });
}

export function drawMoon(g: Graphics, layout: RoomLayout) {
  const { x, y, r } = layout.moon;
  g.clear();
  g.circle(x, y, r * 4).fill(
    radial([
      [0, "rgba(231, 223, 201, 0.16)"],
      [0.35, "rgba(231, 223, 201, 0.06)"],
      [1, "rgba(231, 223, 201, 0)"]
    ])
  );
  g.circle(x, y, r).fill("#ece4cd");
  g.circle(x - r * 0.3, y - r * 0.2, r * 0.22).fill({ color: "#d9d0b6", alpha: 0.7 });
  g.circle(x + r * 0.25, y + r * 0.28, r * 0.15).fill({ color: "#d9d0b6", alpha: 0.6 });
  g.circle(x + r * 0.35, y - r * 0.32, r * 0.09).fill({ color: "#d9d0b6", alpha: 0.55 });
}

export function drawMountains(g: Graphics, layout: RoomLayout) {
  const { width, height, horizonY } = layout;
  g.clear();
  const ranges: Array<{ base: number; amp: number; color: string; seed: number }> = [
    { base: horizonY - height * 0.1, amp: height * 0.07, color: "#26323c", seed: 1.3 },
    { base: horizonY - height * 0.055, amp: height * 0.055, color: "#1f2830", seed: 4.1 },
    { base: horizonY - height * 0.015, amp: height * 0.035, color: "#191f24", seed: 7.7 }
  ];
  for (const range of ranges) {
    const points: number[] = [0, horizonY + 6];
    for (let x = 0; x <= width + 16; x += 16) {
      const t = x / width;
      const ridge =
        Math.sin(t * 5.1 + range.seed) * 0.55 +
        Math.sin(t * 11.3 + range.seed * 2.3) * 0.28 +
        Math.sin(t * 23.7 + range.seed * 0.7) * 0.12;
      points.push(x, range.base - ridge * range.amp);
    }
    points.push(width, horizonY + 6);
    g.poly(points).fill(range.color);
  }
}

export function drawMist(g: Graphics, layout: RoomLayout) {
  const { width, height, horizonY } = layout;
  g.clear();
  for (let index = 0; index < 5; index += 1) {
    g.ellipse(width * (0.1 + index * 0.22), horizonY - height * 0.01, width * 0.22, height * 0.035).fill(
      radial([
        [0, "rgba(190, 200, 205, 0.09)"],
        [1, "rgba(190, 200, 205, 0)"]
      ])
    );
  }
}

export function drawGround(g: Graphics, layout: RoomLayout) {
  const { width, height, horizonY, floorY } = layout;
  g.clear();
  g.rect(0, horizonY, width, height - horizonY).fill(
    vertical([
      [0, "#1c1f1e"],
      [0.35, "#1b1a17"],
      [1, "#121110"]
    ])
  );
  // Stone terrace with a soft rim catching the moonlight.
  g.ellipse(width * 0.5, floorY + 42, width * 0.43, height * 0.16).fill("#26231e");
  g.ellipse(width * 0.5, floorY + 36, width * 0.42, height * 0.15).fill(
    vertical([
      [0, "#3d3a33"],
      [1, "#2b2823"]
    ])
  );
  g.ellipse(width * 0.5, floorY + 36, width * 0.42, height * 0.15).stroke({ color: "#5c584c", alpha: 0.45, width: 1.5 });
  // Inner meditation circle.
  g.ellipse(width * 0.5, floorY + 26, width * 0.31, height * 0.095).fill({ color: "#46423a", alpha: 0.6 });
  g.ellipse(width * 0.5, floorY + 26, width * 0.31, height * 0.095).stroke({ color: "#6b6556", alpha: 0.35, width: 1 });
}

export function drawLantern(g: Graphics, layout: RoomLayout) {
  const { x, y } = layout.lantern;
  g.clear();
  const stone = "#4d473d";
  const stoneDark = "#3a352d";
  const stoneLight = "#615a4c";
  // Shadow on the terrace.
  g.ellipse(x, y + 120, 46, 10).fill({ color: "#000000", alpha: 0.28 });
  // Base and post.
  g.roundRect(x - 34, y + 104, 68, 14, 3).fill(stoneDark);
  g.roundRect(x - 26, y + 92, 52, 14, 3).fill(stone);
  g.roundRect(x - 11, y + 52, 22, 42, 2).fill(stone);
  g.rect(x - 11, y + 52, 5, 42).fill({ color: stoneLight, alpha: 0.5 });
  // Platform under the light box.
  g.roundRect(x - 30, y + 42, 60, 12, 3).fill(stoneDark);
  // Light box with a warm window.
  g.roundRect(x - 22, y + 10, 44, 34, 3).fill(stone);
  g.roundRect(x - 14, y + 16, 28, 24, 2).fill("#e8b765");
  g.rect(x - 1, y + 16, 2, 24).fill({ color: stoneDark, alpha: 0.8 });
  // Roof.
  g.poly([x - 42, y + 12, x + 42, y + 12, x + 22, y - 6, x - 22, y - 6]).fill(stoneDark);
  g.poly([x - 42, y + 12, x + 42, y + 12, x + 40, y + 8, x - 40, y + 8]).fill({ color: stoneLight, alpha: 0.55 });
  g.roundRect(x - 6, y - 14, 12, 10, 4).fill(stone);
}

export function drawLanternGlow(g: Graphics, layout: RoomLayout) {
  const { x, y } = layout.lantern;
  g.clear();
  g.circle(x, y + 28, 120).fill(
    radial([
      [0, "rgba(246, 196, 112, 0.32)"],
      [0.3, "rgba(246, 196, 112, 0.12)"],
      [1, "rgba(246, 196, 112, 0)"]
    ])
  );
  // Pool of light on the terrace.
  g.ellipse(x - 10, y + 124, 150, 34).fill(
    radial([
      [0, "rgba(246, 196, 112, 0.16)"],
      [1, "rgba(246, 196, 112, 0)"]
    ])
  );
}

export function flickerLantern(g: Graphics, time: number) {
  const flicker = Math.sin(time * 7.3) * 0.05 + Math.sin(time * 13.1 + 1.7) * 0.04 + Math.sin(time * 2.2) * 0.06;
  g.alpha = 0.88 + flicker;
}

export function drawChest(g: Graphics, layout: RoomLayout) {
  const { x, y } = layout.chest;
  g.clear();
  const wood = "#5a3d2b";
  const woodDark = "#3f2a1e";
  const brass = "#b89a5e";
  g.ellipse(x, y + 36, 70, 12).fill({ color: "#000000", alpha: 0.3 });
  // Body.
  g.roundRect(x - 52, y - 4, 104, 40, 4).fill(wood);
  g.rect(x - 52, y + 6, 104, 2).fill({ color: woodDark, alpha: 0.7 });
  g.rect(x - 52, y + 18, 104, 2).fill({ color: woodDark, alpha: 0.7 });
  // Lid.
  g.roundRect(x - 54, y - 24, 108, 22, 10).fill(woodDark);
  g.roundRect(x - 52, y - 22, 104, 18, 8).fill(wood);
  g.rect(x - 50, y - 20, 100, 3).fill({ color: "#7a5640", alpha: 0.6 });
  // Brass bands, corners and lock.
  g.rect(x - 40, y - 23, 6, 59).fill({ color: brass, alpha: 0.75 });
  g.rect(x + 34, y - 23, 6, 59).fill({ color: brass, alpha: 0.75 });
  g.roundRect(x - 8, y - 6, 16, 18, 3).fill(brass);
  g.circle(x, y + 3, 2.4).fill(woodDark);
  // A journal resting on the lid.
  g.roundRect(x - 26, y - 34, 40, 11, 2).fill("#2f3d3a");
  g.rect(x - 26, y - 26, 40, 2).fill({ color: "#e9e0c8", alpha: 0.7 });
}

export function drawVignette(g: Graphics, layout: RoomLayout) {
  const { width, height } = layout;
  g.clear();
  // A soft fade at the bottom edge grounds the terrace without darkening the scene.
  g.rect(0, height * 0.82, width, height * 0.18).fill(
    vertical([
      [0, "rgba(5, 5, 6, 0)"],
      [1, "rgba(5, 5, 6, 0.45)"]
    ])
  );
}

export type Firefly = { dot: Graphics; xSeed: number; ySeed: number; speed: number; blink: number };

export function createFireflies(count: number): Firefly[] {
  return Array.from({ length: count }, () => ({
    dot: new Graphics(),
    xSeed: Math.random() * 1000,
    ySeed: Math.random() * 1000,
    speed: 0.12 + Math.random() * 0.22,
    blink: Math.random() * Math.PI * 2
  }));
}

export function drawFireflies(fireflies: Firefly[], layout: RoomLayout, time: number) {
  const { width, height, horizonY } = layout;
  for (const firefly of fireflies) {
    const x = (Math.sin(time * firefly.speed + firefly.xSeed) * 0.5 + 0.5) * width;
    const y = horizonY - height * 0.08 + (Math.cos(time * firefly.speed * 1.3 + firefly.ySeed) * 0.5 + 0.5) * height * 0.32;
    const glow = Math.max(0, Math.sin(time * 1.6 + firefly.blink));
    firefly.dot.clear();
    if (glow < 0.05) continue;
    firefly.dot.circle(x, y, 7).fill({ color: "#f3d88a", alpha: 0.07 * glow });
    firefly.dot.circle(x, y, 1.8).fill({ color: "#fbe9b0", alpha: 0.75 * glow });
  }
}
