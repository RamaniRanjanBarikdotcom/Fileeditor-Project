import type { Metadata } from 'next';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PolicyPage, PolicySection } from '../../components/PolicyPage';

export const metadata: Metadata = {
  title: 'AppToolkitLab Data Protection & Applicable Law',
  description:
    'AppToolkitLab data-protection roles, principles, rights workflow, security response, and official India, EU, and California legal references.',
};

export default function DataPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Data protection & law"
      title="A practical data-protection framework for a multi-product platform."
      description="This page explains the compliance model AppToolkitLab is designed to support. It is not a claim that every law applies, or that technical controls alone complete legal compliance."
      currentPath="/data-policy"
    >
      <PolicySection id="roles" title="1. Data roles">
        <p>
          For account, billing, security, product analytics, and direct-customer activity, the
          AppToolkitLab operator will generally decide why and how information is processed and may
          be described as a data fiduciary, controller, or business. When an organization uploads
          personal data for its own purposes, that organization may be the primary controller or
          data fiduciary and AppToolkitLab may act as its processor or service provider. Contracts
          and a data-processing addendum should document these roles.
        </p>
      </PolicySection>
      <PolicySection id="laws" title="2. Legal frameworks considered">
        <div className="law-grid">
          <article>
            <h3>India</h3>
            <p>
              The Digital Personal Data Protection Act, 2023 and phased Digital Personal Data
              Protection Rules, 2025 establish duties for digital personal data and rights for Data
              Principals. Applicability and commencement dates must be assessed for the operator.
            </p>
            <a
              href="https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Official DPDP Act <ExternalLink />
            </a>
            <a
              href="https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?hl=en-US"
              target="_blank"
              rel="noreferrer"
            >
              Official DPDP Rules <ExternalLink />
            </a>
          </article>
          <article>
            <h3>European Union / EEA</h3>
            <p>
              The GDPR may apply based on establishment, offering goods or services, or monitoring
              people in the EU/EEA. It includes transparency, lawful-basis, processor, security,
              transfer, and data-subject-rights duties.
            </p>
            <a
              href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679"
              target="_blank"
              rel="noreferrer"
            >
              Official GDPR text <ExternalLink />
            </a>
          </article>
          <article>
            <h3>California</h3>
            <p>
              The CCPA, as amended, applies only when statutory scope and thresholds are met. It
              provides qualifying residents rights concerning access, correction, deletion, sale or
              sharing, and sensitive information.
            </p>
            <a href="https://cppa.ca.gov/faq" target="_blank" rel="noreferrer">
              Official CPPA guidance <ExternalLink />
            </a>
          </article>
        </div>
        <p className="policy-caption">
          Other national, state, consumer, tax, accessibility, communications, and sector-specific
          laws may apply. This list is not exhaustive and is not legal advice.
        </p>
      </PolicySection>
      <PolicySection id="principles" title="3. Processing principles">
        <ul>
          <li>
            <strong>Purpose limitation:</strong> state why data is needed and do not reuse it
            incompatibly.
          </li>
          <li>
            <strong>Data minimization:</strong> collect only what is needed for conversion,
            delivery, security, support, and legal records.
          </li>
          <li>
            <strong>Accuracy:</strong> allow account information to be corrected and distinguish
            user input from generated output.
          </li>
          <li>
            <strong>Storage limitation:</strong> attach documented retention and deletion behavior
            to each data category.
          </li>
          <li>
            <strong>Security and accountability:</strong> restrict access, monitor important events,
            test controls, and keep evidence of decisions.
          </li>
        </ul>
      </PolicySection>
      <PolicySection id="rights-workflow" title="4. Rights-request workflow">
        <ol>
          <li>
            Receive the request through a documented channel and record the date and requested
            right.
          </li>
          <li>Verify identity or authorized-agent status without collecting excessive new data.</li>
          <li>Identify applicable law, role, exceptions, and response deadline.</li>
          <li>Search account, file metadata, orders, support, licenses, and relevant providers.</li>
          <li>Complete the request, communicate the outcome, and retain a minimal audit record.</li>
        </ol>
        <p>
          Requests can begin on the <Link href="/contact">contact page</Link>. A production
          deployment should also provide the legally required grievance, appeal, or regulator
          information for its jurisdiction.
        </p>
      </PolicySection>
      <PolicySection id="vendors" title="5. Vendors and international transfers">
        <p>
          Every provider should be assessed for purpose, data categories, location, security,
          retention, subprocessors, breach notice, deletion, and contractual restrictions. When data
          crosses borders, the operator must determine whether adequacy, contractual clauses,
          consent, localization, or another mechanism is required.
        </p>
      </PolicySection>
      <PolicySection id="incident" title="6. Security incident response">
        <p>
          The operational process should cover detection, containment, evidence preservation, risk
          assessment, provider coordination, recovery, and post-incident correction. Legal counsel
          and the appointed privacy contact must determine whether affected people, regulators,
          customers, payment partners, or insurers need notice and within what deadline.
        </p>
      </PolicySection>
      <PolicySection id="business" title="7. Business-customer controls">
        <p>
          Business plans should support role-based access, team removal, auditability, retention
          configuration, protected API credentials, and a data-processing addendum. Customers remain
          responsible for lawful collection, user notices, upload authority, access decisions, and
          reviewing generated output.
        </p>
      </PolicySection>
      <PolicySection id="review" title="8. Governance and review">
        <p>
          Before launch and after material changes, AppToolkitLab should maintain a data inventory,
          processor register, retention schedule, access review, incident exercise, rights-request
          test, and legal assessment. Read the <Link href="/privacy">Privacy Policy</Link> for the
          user-facing information notice.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
