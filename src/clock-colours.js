// Each preset pairs a light timeline fill with darker, legible card accents.
export const clockColours = [
  {
    id: "violet",
    label: "Violet",
    rail: "#b49aca",
    accent: "#655086",
    ink: "#51456f",
    surface: "#f0eef7",
    active: "#e8e2f4",
    border: "#d5cfe4",
  },
  {
    id: "blue",
    label: "Blue",
    rail: "#9db3dc",
    accent: "#385c91",
    ink: "#2e4972",
    surface: "#edf2fa",
    active: "#e1e9f8",
    border: "#cbd8ee",
  },
  {
    id: "rose",
    label: "Rose",
    rail: "#d8a0aa",
    accent: "#904354",
    ink: "#713445",
    surface: "#faeff1",
    active: "#f4e1e5",
    border: "#e8cbd1",
  },
  {
    id: "teal",
    label: "Teal",
    rail: "#87bec1",
    accent: "#296873",
    ink: "#245660",
    surface: "#eaf5f5",
    active: "#dceff0",
    border: "#c5dfe1",
  },
  {
    id: "olive",
    label: "Olive",
    rail: "#b1b97d",
    accent: "#58652c",
    ink: "#465022",
    surface: "#f2f4e8",
    active: "#e8ecd8",
    border: "#d7ddba",
  },
  {
    id: "orange",
    label: "Orange",
    rail: "#dfa47e",
    accent: "#914921",
    ink: "#743918",
    surface: "#faf0e8",
    active: "#f7e5d7",
    border: "#ecd2bf",
  },
  {
    id: "slate",
    label: "Slate",
    rail: "#aab8c4",
    accent: "#4a606e",
    ink: "#3b4d58",
    surface: "#eef3f6",
    active: "#e2ebf0",
    border: "#d1dce3",
  },
];

const presets = new Map(clockColours.map((preset) => [preset.id, preset]));

export function clockColourChoice(value) {
  return presets.has(value) ? value : "";
}

export function clockPalette(role, clocks) {
  if (role === "vd") return { rail: "#8ab59c" };
  if (role === "sit") return { rail: "#d8b879" };

  const index = clocks.findIndex((clock) => clock.id === role);
  const automatic = clockColours[Math.max(index, 0) % clockColours.length];
  return presets.get(clocks[index]?.colour) ?? automatic;
}
