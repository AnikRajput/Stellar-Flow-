/**
 * Vitest setup (referenced by `vite.config.ts` → `test.setupFiles`).
 *
 * Adds jest-dom matchers (`toBeInTheDocument`, `toHaveTextContent`, …) to
 * vitest's `expect` for component tests. Service-level tests need nothing
 * beyond this.
 */
import "@testing-library/jest-dom/vitest";
