// Lightweight module typings for html2canvas.
//
// This project uses a dynamic import for runtime performance. The upstream
// html2canvas type definitions can be very heavy and (in some toolchains)
// can trigger compiler stack overflows during incremental analysis.
//
// We only rely on the default export signature below.

declare module "html2canvas" {
  export interface Html2CanvasOptions {
    useCORS?: boolean;
    allowTaint?: boolean;
    backgroundColor?: string | null;
    scale?: number;
    logging?: boolean;
    ignoreElements?: (element: Element) => boolean;
  }

  const html2canvas: (
    element: HTMLElement,
    options?: Html2CanvasOptions
  ) => Promise<HTMLCanvasElement>;

  export default html2canvas;
}
