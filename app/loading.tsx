import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main
      aria-label="正在加载页面"
      className="mx-auto grid max-w-6xl gap-6 px-6 py-20 sm:px-10"
    >
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-6 h-64 w-full" />
    </main>
  );
}
