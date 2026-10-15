import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/LegalPage';
import { depositPolicy } from '@/config/booking';
import { depositAmount, ESTIMATE_LABEL } from '@/config/pricing';
import { site } from '@/config/site';
import { policyLines } from '@/lib/booking/policy';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata = pageMetadata({
  title: 'Terms & Text Message Program | 916 Dent & Detail',
  description: 'Booking, deposit and estimate terms for 916 Dent & Detail, and how our appointment text messages work: frequency, rates, STOP and HELP.',
  path: '/terms',
});

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms & Text Message Program" updated="[OWNER: set date when counsel approves]">
      <LegalSection id="services" title="Our service and estimates">
        <p>{site.name} provides mobile paintless dent repair and detailing at the location you choose. Prices shown online or given by our assistant are estimates. <strong>{ESTIMATE_LABEL}</strong> Some damage cannot be repaired without paint; if so, we tell you before starting and you decide.</p>
      </LegalSection>
      <LegalSection id="deposit" title="Deposit, changes and cancellations">
        <p>A deposit of ${depositAmount} holds your time and is credited to your final invoice. [OWNER] Amount and policy are placeholders until you confirm them.</p>
        <ul>{policyLines(depositPolicy).map((l) => <li key={l}>{l}</li>)}</ul>
      </LegalSection>
      <LegalSection id="access" title="Access and conditions">
        <p>Please make sure we can reach the vehicle at the booked time. Weather can affect outdoor work; if we need to move your appointment we will contact you and offer a new time.</p>
      </LegalSection>
      <LegalSection id="sms" title="Text message program">
        <p><strong>Program:</strong> {site.name} appointment texts. By ticking the box when you book, or by replying REMIND ME when our assistant asks, you agree to receive text messages from {site.name} about your appointment: confirmation, reminders (typically the day before and 2 hours before), an on-the-way alert, a receipt and a review request, and occasional service reminders.</p>
        <ul>
          <li><strong>Frequency:</strong> message frequency varies with your appointments. Expect a handful per booking.</li>
          <li><strong>Cost:</strong> message and data rates may apply, according to your mobile plan.</li>
          <li><strong>Stop:</strong> reply <strong>STOP</strong> at any time and we will stop texting you. You will get one confirmation. Reply <strong>START</strong> to turn texts back on.</li>
          <li><strong>Help:</strong> reply <strong>HELP</strong> or contact us at <a href={`mailto:${site.email.address}`}>{site.email.address}</a>{site.email.placeholder && <span className="owner-mark"> [OWNER] email</span>}.</li>
          <li><strong>Consent is not a condition of purchase.</strong> You can book without agreeing to texts; you will then get email only.</li>
          <li><strong>Carriers</strong> are not liable for delayed or undelivered messages.</li>
          <li>We do not share your mobile number with third parties for their own marketing. See our <Link href="/privacy">Privacy Policy</Link>.</li>
        </ul>
        <p>If you text us first (for example to ask for a price), we reply to that conversation. That is not agreement to reminder texts: those need the explicit opt-in above.</p>
      </LegalSection>
      <LegalSection id="liability" title="Liability">
        <p>[OWNER] Counsel to supply limitation-of-liability, damage-claim and dispute wording for a mobile repair business, including any warranty you choose to offer. We have deliberately written no warranty claims here.</p>
      </LegalSection>
      <LegalSection id="contact" title="Contact">
        <p>{site.name}, serving {site.areaLabel}. Email <a href={`mailto:${site.email.address}`}>{site.email.address}</a>{site.email.placeholder && <span className="owner-mark"> [OWNER] email</span>}.</p>
      </LegalSection>
    </LegalPage>
  );
}
