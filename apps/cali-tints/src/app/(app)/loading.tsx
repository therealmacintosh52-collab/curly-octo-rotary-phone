import { Page } from "@/components/app/page-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

/** Generic page skeleton: title row, a tile grid, then a list. Route groups with their own shape override this. */
export default function AppLoading() {
  return (
    <Page>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44" />
          <SkeletonText className="w-64" />
        </div>
        <Skeleton className="h-11 w-28" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </Page>
  );
}
