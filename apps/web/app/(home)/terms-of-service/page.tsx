import LegalLayout, { Section } from "../_components/legal-layout";

export const metadata = {
  title: "Terms of Service | Choppr",
  description: "Terms of Service for Choppr — AI video clipping, captions, and export.",
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="June 22, 2026">
      <Section title="1. Agreement to Terms">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Choppr website,
          applications, and services (collectively, the &quot;Service&quot;) operated by Choppr, Inc.
          (&quot;Choppr,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
        </p>
        <p>
          By creating an account or using the Service, you agree to these Terms. If you do not agree,
          do not use Choppr.
        </p>
      </Section>

      <Section title="2. Description of Service">
        <p>
          Choppr is an AI-powered video editing platform that helps creators turn long-form videos into
          short-form clips. Our Service may include, among other features:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>AI clipping — automatically finding and cutting highlight moments</li>
          <li>AI captions and transcription</li>
          <li>Video reframing and aspect-ratio adjustments</li>
          <li>Visual enhancements, stickers, and export tools</li>
          <li>Credit-based processing and subscription plans</li>
        </ul>
        <p>
          We may update, modify, or discontinue features at any time. The Service is provided on an
          &quot;as available&quot; basis.
        </p>
      </Section>

      <Section title="3. Eligibility & Accounts">
        <p>
          You must be at least 13 years old to use Choppr. If you are under 18, you may only use the
          Service with permission from a parent or legal guardian.
        </p>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for
          all activity under your account. Notify us immediately at{" "}
          <a href="mailto:shivang@choppr.pro" className="text-white/75 hover:text-white underline-offset-2 hover:underline">
            shivang@choppr.pro
          </a>{" "}
          if you suspect unauthorized access.
        </p>
      </Section>

      <Section title="4. Your Content">
        <p>
          You retain ownership of videos, audio, images, and other content you upload or submit to
          Choppr (&quot;User Content&quot;). By using the Service, you grant Choppr a limited, non-exclusive,
          worldwide license to host, process, transcode, analyze, and display your User Content solely
          to provide and improve the Service.
        </p>
        <p>
          You represent that you have all rights necessary to upload and process your User Content, and
          that your use of Choppr does not violate any third-party rights or applicable laws.
        </p>
        <p>
          If you submit a public video URL (for example, from YouTube), you confirm you have the right
          to access and use that content for editing purposes.
        </p>
      </Section>

      <Section title="5. Acceptable Use">
        <p>You agree not to use Choppr to:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Upload or process content you do not have rights to use</li>
          <li>Violate copyright, trademark, privacy, or other intellectual property laws</li>
          <li>Upload unlawful, harmful, abusive, harassing, or deceptive content</li>
          <li>Attempt to reverse engineer, scrape, overload, or disrupt the Service</li>
          <li>Resell or redistribute the Service without our written permission</li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate these rules or pose risk to the platform or
          other users.
        </p>
      </Section>

      <Section title="6. Credits, Billing & Payments">
        <p>
          Choppr uses a credit-based system. Credits are consumed when you run jobs such as AI clipping,
          captioning, reframing, or exporting finished videos. Current credit costs are displayed on our
          pricing page and may change with notice.
        </p>
        <p>
          Paid plans and one-time purchases are processed through our payment provider (Dodo Payments).
          By subscribing or purchasing credits, you authorize us and our payment partner to charge your
          selected payment method.
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Subscription credits reset each billing cycle unless otherwise stated</li>
          <li>Top-up credits, where offered, do not expire unless your account is terminated for cause</li>
          <li>Failed processing jobs may be refunded credits at our discretion or as stated on the pricing page</li>
          <li>Except where required by law, payments are non-refundable once credits are granted or services are delivered</li>
        </ul>
        <p>
          You are responsible for applicable taxes. We may change pricing with reasonable notice.
        </p>
      </Section>

      <Section title="7. AI Output & Disclaimer">
        <p>
          Choppr uses automated and AI-assisted tools. Results — including clip selections, captions,
          timing, and visual edits — may be inaccurate or require manual review. You are solely
          responsible for reviewing exported content before publishing it.
        </p>
        <p>
          We do not guarantee that AI-generated outputs will be error-free, viral, or suitable for any
          particular platform or audience.
        </p>
      </Section>

      <Section title="8. Intellectual Property">
        <p>
          Choppr, our logo, software, design, and documentation are owned by Choppr, Inc. or our
          licensors and are protected by intellectual property laws. These Terms do not grant you any
          rights to our brand or underlying technology except the limited right to use the Service.
        </p>
      </Section>

      <Section title="9. Third-Party Services">
        <p>
          The Service may integrate with or link to third-party platforms and providers, including
          authentication (Clerk), cloud storage (Amazon Web Services), payment processing (Dodo Payments),
          email delivery (Resend), and public video platforms. Your use of third-party services is
          subject to their own terms and policies.
        </p>
      </Section>

      <Section title="10. Termination">
        <p>
          You may stop using Choppr at any time. We may suspend or terminate your access if you breach
          these Terms, fail to pay applicable fees, or if we discontinue the Service.
        </p>
        <p>
          Upon termination, your right to use the Service ends. We may delete account data after a
          reasonable retention period, except where we are required to retain it by law.
        </p>
      </Section>

      <Section title="11. Disclaimer of Warranties">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
          WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, SECURE, OR ERROR-FREE.
        </p>
      </Section>

      <Section title="12. Limitation of Liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHOPPR AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
          AFFILIATES WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
          DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
        </p>
        <p>
          OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A)
          THE AMOUNT YOU PAID TO CHOPPR IN THE 12 MONTHS BEFORE THE CLAIM OR (B) USD $50.
        </p>
      </Section>

      <Section title="13. Changes to These Terms">
        <p>
          We may update these Terms from time to time. When we do, we will revise the &quot;Last updated&quot;
          date at the top of this page. Material changes may also be communicated by email or in-app
          notice. Continued use of Choppr after changes become effective constitutes acceptance of the
          updated Terms.
        </p>
      </Section>

      <Section title="14. Governing Law & Contact">
        <p>
          These Terms are governed by the laws of the United States and the State of Delaware, without
          regard to conflict-of-law principles, except where mandatory local law applies.
        </p>
        <p>
          For questions about these Terms, contact us at{" "}
          <a href="mailto:shivang@choppr.pro" className="text-white/75 hover:text-white underline-offset-2 hover:underline">
            shivang@choppr.pro
          </a>.
        </p>
      </Section>
    </LegalLayout>
  );
}
