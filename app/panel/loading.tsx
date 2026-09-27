import { PanelPageSkeleton } from "./_components/skeletons";

/**
 * Instant loading UI for every panel navigation: the target segment renders
 * behind this boundary while its server data loads. Slow pages (media)
 * additionally stream inside the page with a <Suspense> fallback, so their
 * header paints before the data does.
 */
export default function PanelLoading() {
  return <PanelPageSkeleton />;
}
