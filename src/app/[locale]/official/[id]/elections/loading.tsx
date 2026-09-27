import { SiteHeader } from "@/components/SiteHeader";

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-full bg-navy/10 ${className}`} aria-hidden />;
}

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-10" aria-busy>
        <Bar className="h-4 w-32" />
        <Bar className="h-9 w-72" />
        <Bar className="h-5 w-56" />
        <div className="h-[36rem] animate-pulse rounded-2xl border-4 border-navy/10" />
      </main>
    </>
  );
}
