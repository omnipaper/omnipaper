import { z } from "zod";
import { filterStateSchema, sortStateSchema } from "./document-filters";

export const savedViewStateSchema = z.object({
  view: z.enum(["list", "gallery"]).optional(),
  q: z.string().optional(),
  filters: filterStateSchema.optional(),
  sort: sortStateSchema.optional(),
});

export type SavedViewState = z.infer<typeof savedViewStateSchema>;
