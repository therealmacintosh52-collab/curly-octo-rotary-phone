import Link from 'next/link';
import { LegalPage, LegalSection } from '@/components/LegalPage';
import { site } from '@/config/site';
import { retentionDays } from '@/lib/concierge/config';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata = pageMetadata({
  title: 'Privacy Policy | 916 Dent & Detail',
  description: 'What 916 Dent & Detail collects when you book, text, chat or visit the site, why, who helps us process it, and how to ask us to delete it.',
  path: '/privacy',
});

export default function PrivacyPage() {
  const days = retentionDays();
  return (
    <LegalPage eyebrow="Legal" title="Privacy Policy" updated="[OWNER: set date when counsel approves]">
      <LegalSection id="who" title="Who we are">
        <p>{site.name} is a mobile dent repair and detailing business serving {site.areaLabel}. In this policy, &ldquo;we&rdquo; means {site.name}. Questions or requests: <a href={`mailto:${site.email.address}`}>{site.email.address}</a>{site.email.placeholder && <span className="owner-mark"> [OWNER] email</span>}.</p>
      </LegalSection>
      <LegalSection id="collect" title="What we collect">
        <ul>
          <li><strong>When you book or ask for a quote:</strong> name, phone, email, the address where we will work, vehicle year/make/model, the services you pick, notes you type, and photos you upload.</li>
          <li><strong>When you chat with the 916 Concierge (website chat or text message):</strong> your messages, any photos you send, and the details the assistant needs to quote or book. The assistant is an AI. We keep the conversation so our team can follow up.</li>
          <li><strong>Payments:</strong> deposits and invoices are paid through Stripe. Card details go to Stripe; we never see or store your full card number.</li>
          <li><strong>Our records of your jobs:</strong> appointment times, job photos, invoices, notes, whether you agreed to receive texts and when.</li>
          <li><strong>Website use:</strong> pages visited, device and browser, and how you found us (for example the ad or search that brought you). Optional analytics and advertising cookies only load after you choose to allow them.</li>
        </ul>
      </LegalSection>
      <LegalSection id="use" title="How we use it">
        <ul>
          <li>To price, schedule, perform and invoice the work, and to send appointment confirmations, reminders, and receipts.</li>
          <li>To answer your questions and follow up on conversations you started.</li>
          <li>To text you only in the ways described in the <Link href="/terms#sms">text message program terms</Link>.</li>
          <li>To measure which pages and ads work (only with your cookie choice), and to keep the site secure and prevent abuse.</li>
          <li>We do not sell your personal information for money. If you allow advertising cookies, advertising partners may receive limited data about your visit; you can turn this off at any time from the cookie settings link in the footer or with a Global Privacy Control browser signal.</li>
        </ul>
      </LegalSection>
      <LegalSection id="share" title="Who helps us process it">
        <p>We use service providers that handle data on our behalf. As built, these are: a database and file host (Supabase), payments (Stripe), text messaging (Twilio), email (Resend), an AI model provider for photo estimates and the Concierge (Anthropic), website hosting and analytics (Vercel), and, if you allow optional cookies, Google Analytics, Google Ads and Meta. [OWNER] Confirm this list matches what you actually switch on before launch.</p>
        <p>We may also share information if the law requires it, or to protect our customers, our team, or our business.</p>
      </LegalSection>
      <LegalSection id="retention" title="How long we keep it">
        <ul>
          <li><strong>Chat and text transcripts</strong> are deleted automatically about {days} days after the last message, unless a conversation is still waiting for our team.</li>
          <li><strong>Job, invoice and payment records</strong> are kept as long as needed for taxes, warranties and disputes. [OWNER] Counsel to set the period.</li>
          <li><strong>Uploaded photos</strong> are kept with the job or quote they belong to. We only use job photos in marketing if you agreed to that for that job.</li>
        </ul>
      </LegalSection>
      <LegalSection id="rights" title="Your choices and rights">
        <p>You can ask us to tell you what we hold about you, correct it, or delete it by emailing us. We will check it is really you before acting. You can stop texts at any time by replying STOP to any message. You can turn off optional cookies from the cookie settings link in the footer. California residents may have additional rights under state privacy law. [OWNER] Counsel to confirm which laws apply to this business and complete this section.</p>
      </LegalSection>
      <LegalSection id="security" title="Security">
        <p>Data is stored with the providers above using access controls and encrypted connections. No system is perfectly secure, so we cannot guarantee absolute security.</p>
      </LegalSection>
      <LegalSection id="children" title="Children">
        <p>Our services are for adults who own or manage vehicles. We do not knowingly collect information from children.</p>
      </LegalSection>
      <LegalSection id="changes" title="Changes">
        <p>If we change this policy we will post the new version here with a new date.</p>
      </LegalSection>
    </LegalPage>
  );
}
