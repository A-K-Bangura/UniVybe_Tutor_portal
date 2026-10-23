export const contentLevelOptions = [
  ...["UnderGrad", "100", "200", "300", "400", "500", "graduate"].map(
    (value) => ({ value, label: value }),
  ),
  { value: "general", label: "General — wider audience" },
];

export const levelLabel = (value: unknown) =>
  value === "general"
    ? "General — wider audience"
    : typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";
