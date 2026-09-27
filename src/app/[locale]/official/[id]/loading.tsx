import { ProfileSkeleton } from "@/components/Skeletons";
import { SiteHeader } from "@/components/SiteHeader";

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <ProfileSkeleton />
    </>
  );
}
