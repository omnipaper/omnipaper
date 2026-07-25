import { createLogger } from "@omnipaper/logger";

export const serverLogger = createLogger("server");
export const httpLogger = createLogger("http");
export const taskLogger = createLogger("task");
export const demoLogger = createLogger("demo");
