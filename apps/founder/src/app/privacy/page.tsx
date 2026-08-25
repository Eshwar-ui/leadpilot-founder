import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — LeadPilot",
  description: "How LeadPilot collects, uses, and protects data in the LeadPilot Telecaller app and platform.",
};

const LAST_UPDATED = "24 August 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-3 text-slate-700 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        LeadPilot Privacy Policy
      </h1>
      <p className="text-sm text-slate-500 mb-12">
        Last updated: {LAST_UPDATED}. Applies to the LeadPilot Telecaller
        Android app and the LeadPilot web platform.
      </p>

      <Section title="Who we are">
        <p>
          LeadPilot is a sales-calling and lead-management platform operated
          by <strong>Asan Innovators</strong> (&ldquo;LeadPilot,&rdquo;
          &ldquo;we,&rdquo; &ldquo;us&rdquo;), India. This policy covers the
          LeadPilot Telecaller mobile app (installed by sales
          representatives) and the LeadPilot web dashboard (used by their
          managers/founders).
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          <strong>Account &amp; organisation data.</strong> Name, email,
          phone number, and organisation details provided at signup or by
          your employer when they add you as a telecaller.
        </p>
        <p>
          <strong>Call recordings and transcripts.</strong> The app reads
          the call-recording file your phone&rsquo;s own dialer app already
          saves after a call (LeadPilot does not itself record calls or use
          your microphone directly). That audio file is uploaded to our
          servers, transcribed to text, and analysed to produce a call
          summary, lead-quality score, and coaching feedback for your
          manager.
        </p>
        <p>
          <strong>Call metadata.</strong> Phone numbers dialed/received,
          call timestamps, and call duration, used to match a recording to
          the correct lead and to compute performance statistics (calls
          made, talk time, conversion rate).
        </p>
        <p>
          <strong>Device information.</strong> Device manufacturer, model,
          and Android OS version. This is used to measure how reliably the
          app can locate call recordings across different phone brands, so
          we can improve that feature — it is not used to identify you
          individually beyond your existing account.
        </p>
        <p>
          <strong>Push notification token.</strong> A Firebase Cloud
          Messaging token, used to deliver in-app notifications (e.g. new
          lead assigned, follow-up reminder).
        </p>
        <p>
          <strong>What we do not collect.</strong> LeadPilot does not access
          your location, does not read your photos or other personal media,
          and does not use <code>RECORD_AUDIO</code> to actively listen to
          or record anything — it only reads the recording file your
          dialer already created.
        </p>
      </Section>

      <Section title="Why the app requests broad file access">
        <p>
          The LeadPilot Telecaller app requests Android&rsquo;s &ldquo;All
          files access&rdquo; permission (<code>MANAGE_EXTERNAL_STORAGE</code>)
          and call-log read access (<code>READ_CALL_LOG</code>). These are
          used exclusively to locate the call-recording file your phone&rsquo;s
          dialer app saves after a work call, and to detect when a call has
          ended so the in-call notes overlay can close automatically.
          Different phone manufacturers store call recordings in different,
          undocumented folders, which is why broad file access — rather
          than a narrower media-only permission — is currently required for
          this feature to work across devices. We do not use this access to
          read, modify, or delete any other files on your device.
        </p>
      </Section>

      <Section title="How we use it">
        <ul className="list-disc pl-5 space-y-2">
          <li>
            Transcribing calls and generating a lead-quality score and
            coaching summary, shown to you and your manager in the app/
            dashboard.
          </li>
          <li>
            Computing performance statistics (calls made, talk time,
            connect rate, quality score trends) for individual and team
            reporting.
          </li>
          <li>Sending you push notifications relevant to your work queue.</li>
          <li>
            Improving the reliability of call-recording capture across
            different phone models (aggregated, not used to profile
            individuals).
          </li>
          <li>Diagnosing bugs and securing the service against misuse.</li>
        </ul>
        <p>
          We do not sell your data, and we do not use call recordings or
          transcripts for advertising.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>
          We use the following processors to run the service. Each only
          receives the specific data needed to perform its function:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Sarvam AI</strong> (India) — speech-to-text
            transcription and, depending on configuration, call scoring.
          </li>
          <li>
            <strong>Google (Gemini API / Firebase)</strong> — call scoring
            (when this engine is active) and push notification delivery.
          </li>
          <li>
            <strong>Supabase</strong> — encrypted storage of audio files,
            transcripts, and application data.
          </li>
          <li>
            <strong>Render</strong> — hosting for the LeadPilot backend
            service.
          </li>
        </ul>
        <p>
          Within your organisation, your call data and performance metrics
          are visible to your organisation&rsquo;s managers/founders, as is
          standard for a workplace CRM tool. We do not share your data with
          other organisations using LeadPilot.
        </p>
      </Section>

      <Section title="Data retention">
        <p>
          Call recordings, transcripts, and analysis results are retained
          for as long as your organisation has an active LeadPilot
          subscription, and for <strong>90 days</strong> after account
          closure, after which they are permanently deleted. Account and
          performance-metric data may be retained longer in aggregated,
          de-identified form for reporting purposes.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can request access to, correction of, or deletion of your
          personal data, or ask us what data we hold about you, by
          contacting <strong>asankalyan@gmail.com</strong>. Because call
          recordings may also contain a third party&rsquo;s (the
          lead&rsquo;s) voice, deletion requests are handled in line with
          your organisation&rsquo;s data-retention obligations as the data
          controller for its own leads.
        </p>
      </Section>

      <Section title="Children">
        <p>
          LeadPilot is a workplace tool for adult sales representatives and
          is not directed at, or knowingly used by, children.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We&rsquo;ll update the &ldquo;Last updated&rdquo; date above when
          this policy changes, and notify organisation admins of material
          changes.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions about this policy or your data:{" "}
          <strong>asankalyan@gmail.com</strong>.
        </p>
      </Section>
    </main>
  );
}
