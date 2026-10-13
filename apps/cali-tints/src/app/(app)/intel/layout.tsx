import { IntelNav } from "@/components/intel/intel-nav";

/** The Intel area: Codes · Garage. Same shell, its own section switcher. */
export default function IntelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <IntelNav />
      </div>
      {children}
    </div>
  );
}
