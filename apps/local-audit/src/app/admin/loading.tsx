import { Page } from "@/components/app/page-header";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <Page>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44" />
          <SkeletonText className="w-64" />
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </Page>
  );
}
