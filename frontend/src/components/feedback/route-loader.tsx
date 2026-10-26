"use client";

import { KioLoadingIndicator } from "@/components/brand/kio-agent-loader";

export default function RouteLoader({
  label = "Loading KIO...",
}: {
  label?: string;
}) {
  return (
    <main className="route-loader" aria-busy="true">
      <KioLoadingIndicator size="page" label={label} />
    </main>
  );
}
