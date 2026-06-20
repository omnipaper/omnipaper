let demoMode = false;

export function setDemoMode(value: boolean): void {
  demoMode = value;
}

export function getDemoMode(): boolean {
  return demoMode;
}

export class DemoReadOnlyError extends Error {
  constructor() {
    super("This is a read-only demo — your changes weren't saved.");
    this.name = "DemoReadOnlyError";
  }
}
