import { DeckSkeleton } from "@/components/Skeletons";
import { SiteHeader } from "@/components/SiteHeader";

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <DeckSkeleton />
    </>
  );
}
