export const FIELD_SOURCES = ["human", "ai"] as const;

export type FieldSource = (typeof FIELD_SOURCES)[number];

// Snapshots, not references: a change row keeps showing what was on screen at the time.
export type FieldChangeValue = { id: string; name: string } | { value: string };
