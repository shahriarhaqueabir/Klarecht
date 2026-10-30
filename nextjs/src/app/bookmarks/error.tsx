"use client";

import { ErrorPageShell } from "@/components/error-page-shell";

export default function BookmarksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPageShell
      error={error}
      reset={reset}
      title="Bookmarks Error"
      message="Failed to load your bookmarks. Please try again."
      logContext="Bookmarks error boundary"
    />
  );
}
