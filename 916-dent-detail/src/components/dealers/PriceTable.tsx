import Link from 'next/link';
import { dealerWholesale, formatMoney } from '@/config/pricing';
import { dealerServices, resolveRate } from '@/lib/dealers/catalog';

/** Per-panel wholesale rates. Shows a number only when config/pricing.ts has a real one; otherwise "Request wholesale sheet". */
export function PriceTable() {
  const anyPlaceholder = dealerServices.some((s) => resolveRate(s.id, null, dealerWholesale) === null);
  return (
    <div>
      <div className="dl-card overflow-hidden">
        <table className="dl-table">
          <caption className="sr-only">Wholesale rates by service</caption>
          <thead><tr><th scope="col">Service</th><th scope="col">Unit</th><th scope="col" className="num">Wholesale rate</th></tr></thead>
          <tbody>
            {dealerServices.map((s) => {
              const rate = resolveRate(s.id, null, dealerWholesale);
              return (
                <tr key={s.id}>
                  <th scope="row" className="!border-b !border-[#202227] !text-sm !font-semibold !normal-case !tracking-normal !text-ivory">{s.plain}<span className="block text-xs font-normal text-steel">{s.term}</span></th>
                  <td className="text-steel">per {s.unit}</td>
                  <td className="num">
                    {rate === null
                      ? <Link href="#wholesale-sheet" className="text-gold-light underline underline-offset-4">Request wholesale sheet</Link>
                      : <span className="font-semibold text-ivory">{formatMoney(rate).text}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {anyPlaceholder && <p className="mt-3 text-sm text-steel"><span className="owner-mark">[OWNER] set wholesale rates</span> in <code>src/config/pricing.ts</code> (or per dealer in /admin/dealers). No price is shown until you do.</p>}
      <p className="mt-3 text-sm text-steel">Hail work is quoted from photos. Rates cover paint-intact panels; we tell you before we start if a panel is not a good fit for paintless repair.</p>
    </div>
  );
}
