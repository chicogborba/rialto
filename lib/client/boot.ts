/**
 * Boot signal for the landing page: the hero scene resolves this once its first frame is on screen
 * (or once it gave up, e.g. no WebGL), and the preloader waits for it before revealing the page.
 */
let resolve: () => void = () => undefined;
export const heroReady: Promise<void> = new Promise((r) => {
  resolve = r;
});
export const markHeroReady = (): void => resolve();
