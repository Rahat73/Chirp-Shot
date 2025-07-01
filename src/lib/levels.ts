export type Target = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  destroyed: boolean;
};

export type Level = {
  id: number;
  structure: string;
  targets: Target[];
  bird: {
    x: number;
    y: number;
  };
};

export const levels: Level[] = [
  {
    id: 1,
    structure: "A single block at (600, 400).",
    targets: [{ id: 1, x: 600, y: 400, width: 50, height: 50, destroyed: false }],
    bird: { x: 100, y: 350 },
  },
  {
    id: 2,
    structure: "A tower of two blocks at (650, 350) and (650, 400).",
    targets: [
      { id: 1, x: 650, y: 400, width: 50, height: 50, destroyed: false },
      { id: 2, x: 650, y: 350, width: 50, height: 50, destroyed: false },
    ],
    bird: { x: 100, y: 350 },
  },
  {
    id: 3,
    structure: "A small pyramid with a base of two blocks at (700, 400) and (760, 400), and a top block at (730, 350).",
    targets: [
      { id: 1, x: 700, y: 400, width: 50, height: 50, destroyed: false },
      { id: 2, x: 760, y: 400, width: 50, height: 50, destroyed: false },
      { id: 3, x: 730, y: 350, width: 50, height: 50, destroyed: false },
    ],
    bird: { x: 100, y: 350 },
  },
];
