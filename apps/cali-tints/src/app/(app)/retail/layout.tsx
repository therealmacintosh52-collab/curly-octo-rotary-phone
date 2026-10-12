import { RetailNav } from "@/components/retail/retail-nav";

/** The retail area: Today · Customers (Calendar and Estimates follow). Same shell, its own section switcher. */
export default function RetailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <RetailNav />
      </div>
      {children}
    </div>
  );
}
