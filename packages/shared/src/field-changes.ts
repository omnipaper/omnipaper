export const FIELD_SOURCES = ["human", "ai"] as const;

export type FieldSource = (typeof FIELD_SOURCES)[number];

// Change values are snapshots, not references: entities get renamed or deleted, but a change row
// must keep showing what was on screen at the time. Referenced entities carry {id, name},
// free-form fields (title, date, custom values) carry {value}.
export type FieldChangeValue = { id: string; name: string } | { value: string };
