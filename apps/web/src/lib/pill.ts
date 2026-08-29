// Sizing for the pill control row above document lists (filter chips, + Filter, Display, Save
// view). Mirrors FilterFieldChip's anatomy — text-xs on a 16px line with 6px vertical padding —
// so buttons and chips sit at exactly the same height. Rounding is applied per call site, because
// split buttons round each edge differently.
export const pillControl = "h-auto gap-1.5 py-1.5 leading-4 [&_svg:not([class*='size-'])]:size-3.5";
