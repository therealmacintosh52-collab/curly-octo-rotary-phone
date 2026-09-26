import { Page } from "@/components/app/page-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** Mirrors the Jobs page shape so nothing jumps when the data lands. */
export default function JobsLoading() {
  return (
    <Page>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <SkeletonText className="w-56" />
        </div>
        <Skeleton className="h-11 w-28" />
      </div>
      <div className="mt-5 flex flex-col gap-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full sm:w-96" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] rounded-xl" />
        ))}
      </div>
    </Page>
  );
}
