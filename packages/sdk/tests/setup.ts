// jsdom doesn't implement the CSSOM `CSS.escape()` static used by packages/sdk/src/containers.ts
// to look up inline containers by widget name. Polyfill it (per the CSSOM spec algorithm) so tests
// exercise the same code path real browsers do.
if (typeof (globalThis as any).CSS === "undefined" || typeof (globalThis as any).CSS.escape !== "function") {
  (globalThis as any).CSS = {
    ...(globalThis as any).CSS,
    escape(value: string): string {
      return String(value).replace(/([^\w-])/g, (ch) => `\\${ch}`);
    },
  };
}
