import type { Metadata } from 'next';
import Link from 'next/link';
import { PolicyPage, PolicySection } from '../../components/PolicyPage';

export const metadata: Metadata = {
  title: 'AppToolkitLab Refund Policy',
  description:
    'How AppToolkitLab reviews subscription, digital product, duplicate charge, and technical failure refund requests.',
};

export default function RefundPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Refund policy"
      title="A transparent review process for subscriptions and digital products."
      description="Refund eligibility depends on what was purchased, what was delivered or used, the checkout promise, technical evidence, and rights that cannot be excluded by law."
      currentPath="/refund-policy"
    >
      <PolicySection id="before-buying" title="1. Before buying">
        <p>
          Confirm the product version, operating system, system requirements, license limits,
          supported formats, currency, tax, renewal period, and product status. A preview listing
          without an active checkout cannot be purchased. Contact support before paying when
          compatibility is uncertain.
        </p>
      </PolicySection>
      <PolicySection id="subscriptions" title="2. SaaS subscriptions">
        <p>
          Unless checkout expressly provides a trial or money-back period, subscription charges are
          generally non-refundable after a billing period begins, except where required by law or
          for a verified duplicate charge, billing error, or material service failure. Cancelling
          stops the next renewal when completed before the renewal deadline; it does not
          automatically refund the current period.
        </p>
      </PolicySection>
      <PolicySection id="digital" title="3. Downloadable software and digital assets">
        <p>
          Because digital products can be copied or used immediately, purchases are generally final
          once the asset is downloaded or a license is activated, except where mandatory law applies
          or the item is materially defective, not as described, or cannot be delivered.
          Product-specific checkout terms may offer broader rights and will be honored.
        </p>
      </PolicySection>
      <PolicySection id="eligible" title="4. Requests we will review">
        <ul>
          <li>A duplicate or incorrect charge.</li>
          <li>A purchased file or license that was never made available.</li>
          <li>A reproducible material defect that support cannot reasonably resolve.</li>
          <li>A product materially different from its checkout description.</li>
          <li>A request within an explicit guarantee shown on the receipt or checkout page.</li>
          <li>Any refund, cancellation, or withdrawal right required by applicable law.</li>
        </ul>
        <p>
          A change of mind, unsupported environment disclosed before purchase, consumed quota,
          completed work, or failure to follow documented requirements may not qualify unless law
          says otherwise.
        </p>
      </PolicySection>
      <PolicySection id="request" title="5. How to request a review">
        <p>
          Use the <Link href="/contact">contact page</Link> and provide the account email, order or
          invoice ID, product and version, purchase date, issue description, troubleshooting already
          attempted, and relevant screenshots or error messages. Never send full card, bank,
          password, private key, or identity-document information unless support provides a secure
          and legally necessary process.
        </p>
      </PolicySection>
      <PolicySection id="process" title="6. Review and payment timing">
        <p>
          Support should acknowledge a complete request, verify the transaction and usage state,
          attempt reasonable troubleshooting, and communicate approval or denial with a reason.
          Approved refunds are returned through the original provider when possible. Bank, card
          network, currency conversion, and payment-provider processing times are outside
          AppToolkitLab&apos;s control.
        </p>
      </PolicySection>
      <PolicySection id="taxes" title="7. Taxes, currency, and partial refunds">
        <p>
          Refunded taxes and currency differences depend on law and provider rules. Partial refunds
          may be considered for a divisible service failure but are not guaranteed. Promotional
          value, coupons, credits, and bundled items may be allocated across an order.
        </p>
      </PolicySection>
      <PolicySection id="chargebacks" title="8. Chargebacks and abuse">
        <p>
          Contact support first so the issue can be investigated. Fraudulent claims, altered
          evidence, repeated refund abuse, or chargebacks after a refund has already been issued may
          lead to account restriction while preserving rights that cannot be waived.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
