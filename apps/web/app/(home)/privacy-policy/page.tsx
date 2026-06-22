import LegalLayout, { Section } from "../_components/legal-layout";

export const metadata = {
  title: "Privacy Policy | Choppr",
  description: "Privacy Policy for Choppr — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="June 22, 2026">
      <Section title="1. Introduction">
        <p>
          Choppr, Inc. (&quot;Choppr,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates choppr.pro and related
          applications that help creators turn long videos into short-form clips using AI-assisted tools.
        </p>
        <p>
          This Privacy Policy explains what information we collect, how we use it, who we share it with,
          and what choices you have. By using Choppr, you agree to the practices described here.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p><strong className="text-white/80">Account information.</strong> When you sign up, we collect information such as your name, email address, and authentication details through our identity provider (Clerk).</p>
        <p><strong className="text-white/80">Content you provide.</strong> This includes videos, audio, captions, project settings, clip edits, and URLs you submit (including public video links from platforms like YouTube).</p>
        <p><strong className="text-white/80">Usage and device data.</strong> We collect information about how you use Choppr, such as pages visited, features used, export activity, credit usage, browser type, IP address, and general device or log data.</p>
        <p><strong className="text-white/80">Payment information.</strong> Paid subscriptions and credit purchases are handled by our payment processor (Dodo Payments). We receive billing status, plan details, and transaction metadata, but we do not store full payment card numbers on our servers.</p>
        <p><strong className="text-white/80">Communications.</strong> If you contact support or receive emails from us, we keep those messages and related metadata.</p>
      </Section>

      <Section title="3. How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Provide, operate, and maintain the Service</li>
          <li>Process videos, generate clips, captions, reframes, and exports</li>
          <li>Manage accounts, credits, subscriptions, and billing</li>
          <li>Send transactional emails such as welcome messages and account notices</li>
          <li>Monitor performance, prevent abuse, and improve reliability</li>
          <li>Develop new features and fix bugs</li>
          <li>Comply with legal obligations and enforce our Terms of Service</li>
        </ul>
      </Section>

      <Section title="4. How We Process Video Content">
        <p>
          When you upload a video or submit a URL, your content is processed on our infrastructure and
          third-party cloud services to deliver clipping, transcription, editing, and export features.
        </p>
        <p>
          Some preview features (such as real-time sticker or segmentation previews) may run locally in
          your browser using client-side libraries. Exported and stored outputs are processed on our
          servers.
        </p>
        <p>
          We process your content only to provide the Service and as described in this policy. We do not
          sell your videos or use them to train public models unless we clearly tell you otherwise and
          obtain your consent.
        </p>
      </Section>

      <Section title="5. How We Share Information">
        <p>We may share information with:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li><strong className="text-white/80">Service providers</strong> who help us operate Choppr, such as cloud hosting and storage (AWS), authentication (Clerk), payments (Dodo Payments), email delivery (Resend), and analytics or infrastructure partners</li>
          <li><strong className="text-white/80">Legal and safety requests</strong> when required by law, court order, or to protect rights, safety, and security</li>
          <li><strong className="text-white/80">Business transfers</strong> in connection with a merger, acquisition, financing, or sale of assets, subject to appropriate confidentiality protections</li>
        </ul>
        <p>We do not sell your personal information.</p>
      </Section>

      <Section title="6. Data Retention">
        <p>
          We retain account and project data for as long as your account is active or as needed to provide
          the Service. Video files, exports, and related metadata may be stored until you delete them or
          close your account, subject to backup and legal retention requirements.
        </p>
        <p>
          We may retain certain logs, billing records, and support communications for a longer period
          where required for security, accounting, or legal compliance.
        </p>
      </Section>

      <Section title="7. Security">
        <p>
          We use reasonable administrative, technical, and organizational measures to protect your
          information, including encrypted connections (HTTPS), access controls, and secure cloud
          infrastructure. No method of transmission or storage is 100% secure, and we cannot guarantee
          absolute security.
        </p>
      </Section>

      <Section title="8. Your Choices & Rights">
        <p>Depending on where you live, you may have the right to:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Access, correct, or delete personal information we hold about you</li>
          <li>Object to or restrict certain processing</li>
          <li>Export a copy of your data</li>
          <li>Withdraw consent where processing is based on consent</li>
        </ul>
        <p>
          You can update account details through your profile settings where available. To make a privacy
          request, email{" "}
          <a href="mailto:shivang@choppr.pro" className="text-white/75 hover:text-white underline-offset-2 hover:underline">
            shivang@choppr.pro
          </a>.
        </p>
        <p>
          You may opt out of non-essential marketing emails by using the unsubscribe link in those
          messages. Transactional emails related to your account may still be sent.
        </p>
      </Section>

      <Section title="9. Cookies & Similar Technologies">
        <p>
          We and our providers use cookies and similar technologies for authentication, session
          management, security, and basic analytics. You can control cookies through your browser
          settings, but disabling them may limit certain features of Choppr.
        </p>
      </Section>

      <Section title="10. Children&apos;s Privacy">
        <p>
          Choppr is not directed to children under 13, and we do not knowingly collect personal
          information from children under 13. If you believe a child has provided us personal
          information, contact us and we will take appropriate steps to delete it.
        </p>
      </Section>

      <Section title="11. International Users">
        <p>
          Choppr is operated from the United States. If you access the Service from outside the U.S.,
          your information may be transferred to, stored in, and processed in the U.S. or other countries
          where our service providers operate, which may have different data protection laws than your
          jurisdiction.
        </p>
      </Section>

      <Section title="12. Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we will revise the
          &quot;Last updated&quot; date above. Material changes may also be communicated by email or in-app
          notice. Your continued use of Choppr after an update means you accept the revised policy.
        </p>
      </Section>

      <Section title="13. Contact Us">
        <p>
          If you have questions about this Privacy Policy or our data practices, contact:
        </p>
        <p>
          Choppr, Inc.<br />
          Email:{" "}
          <a href="mailto:shivang@choppr.pro" className="text-white/75 hover:text-white underline-offset-2 hover:underline">
            shivang@choppr.pro
          </a>
        </p>
      </Section>
    </LegalLayout>
  );
}
