/**
 * Build-mode helpers. The full app (API routes + database) runs locally or on a Node host.
 * The GitHub Pages build is a static export of the landing page only (STATIC_EXPORT=1), where
 * anything that needs the backend points people to the repository instead.
 */
export const STATIC_PREVIEW = process.env.NEXT_PUBLIC_STATIC === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const REPO_URL = "https://github.com/chicogborba/rialto";

/** Prefix a /public asset path with the deploy base path (needed on GitHub Pages project sites). */
export const asset = (path: string): string => `${BASE_PATH}${path}`;

/** Where a flow link goes: the real page, or the repo's quickstart in the static preview. */
export function flowHref(path: string): string {
  return STATIC_PREVIEW ? `${REPO_URL}#quickstart` : path;
}
