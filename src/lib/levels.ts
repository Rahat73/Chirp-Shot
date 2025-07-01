export type Block = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  destroyed: boolean;
};

export type Pig = {
  id: number;
  x: number;
  y: number;
  destroyed: boolean;
};

export type Level = {
  id: number;
  structure: string;
  blocks: Block[];
  pigs: Pig[];
  birdCount: number;
  bird: {
    x: number;
    y: number;
  };
};

export const levels: Level[] = [
  {
    id: 1,
    structure: "A single pig at (700, 410) is protected by a simple wall of three blocks in front of it at (640, 400), (640, 350), and (640, 300).",
    pigs: [{ id: 1, x: 700, y: 410, destroyed: false }],
    blocks: [
        { id: 1, x: 640, y: 400, width: 20, height: 50, destroyed: false },
        { id: 2, x: 640, y: 350, width: 20, height: 50, destroyed: false },
        { id: 3, x: 640, y: 300, width: 20, height: 50, destroyed: false },
    ],
    birdCount: 3,
    bird: { x: 100, y: 350 },
  },
  {
    id: 2,
    structure: "Two pigs at (700, 410) and (820, 410) are in a structure. A tower of two blocks at (650, 400) and (650, 350) and a horizontal block on top at (675, 330). A second tower protects the other pig.",
    pigs: [
      { id: 1, x: 700, y: 410, destroyed: false },
      { id: 2, x: 820, y: 410, destroyed: false },
    ],
    blocks: [
      { id: 1, x: 650, y: 400, width: 20, height: 50, destroyed: false },
      { id: 2, x: 650, y: 350, width: 20, height: 50, destroyed: false },
      { id: 3, x: 780, y: 400, width: 20, height: 50, destroyed: false },
      { id: 4, x: 780, y: 350, width: 20, height: 50, destroyed: false },
      { id: 5, x: 670, y: 330, width: 130, height: 20, destroyed: false },
    ],
    birdCount: 4,
    bird: { x: 100, y: 350 },
  },
  {
    id: 3,
    structure: "Three pigs are inside a complex castle-like structure. Bottom pigs at (650, 410) and (850, 410). Top pig at (750, 240). The structure is made of vertical and horizontal blocks creating rooms.",
    pigs: [
        { id: 1, x: 650, y: 410, destroyed: false },
        { id: 2, x: 850, y: 410, destroyed: false },
        { id: 3, x: 750, y: 240, destroyed: false },
    ],
    blocks: [
      // Left Tower
      { id: 1, x: 620, y: 400, width: 20, height: 50, destroyed: false },
      { id: 2, x: 620, y: 350, width: 20, height: 50, destroyed: false },
      { id: 3, x: 620, y: 300, width: 20, height: 50, destroyed: false },
      // Right Tower
      { id: 4, x: 880, y: 400, width: 20, height: 50, destroyed: false },
      { id: 5, x: 880, y: 350, width: 20, height: 50, destroyed: false },
      { id: 6, x: 880, y: 300, width: 20, height: 50, destroyed: false },
      // Middle Tower
      { id: 7, x: 750, y: 400, width: 20, height: 50, destroyed: false },
      { id: 8, x: 750, y: 350, width: 20, height: 50, destroyed: false },
      // Roof
      { id: 9, x: 620, y: 280, width: 280, height: 20, destroyed: false },
    ],
    birdCount: 4,
    bird: { x: 100, y: 350 },
  },
];
