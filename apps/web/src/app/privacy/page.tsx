import type { Metadata } from "next";

import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Hero Kids Universe",
  description: "Privacy Policy for Hero Kids Universe by Accurate IT Solution.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="How Hero Kids Universe handles account details, story data, images, orders, and support communication."
      updatedAt="26 June 2026"
      sections={[
        {
          title: "Who we are",
          body: [
            "Hero Kids Universe is operated by Accurate IT Solution, located at 136 Industrial Area Phase-2, Panchkula, Haryana, 134113, India.",
            "You can contact us about privacy, account, or data questions at support@accurateitsolution.in.",
          ],
        },
        {
          title: "Information we collect",
          body: [
            "When you create an account, we collect information such as your name, email address, login details, subscription or credit balance, and activity needed to provide the service.",
            "When you create heroes, characters, universes, and stories, we store the details you enter, such as names, dates of birth, story prompts, selected themes, generated story text, generated avatars, generated illustrations, narration, and universe memory.",
            "When you place a merchandise or physical order, we may collect shipping details such as recipient name, phone number, address, city, state, postal code, order items, order status, and delivery information.",
          ],
        },
        {
          title: "Photos and generated images",
          body: [
            "Photo uploads are used to create personalized avatars and storybook-style results. We do not use original uploaded photos for advertising, resale, or unrelated model training.",
            "Our intended product behavior is that original uploaded photos are not retained as permanent customer assets after the avatar workflow. Generated avatars, story illustrations, product mockups, and final story assets may be stored so your account, stories, and orders continue to work.",
            "Please upload only photos that you have the right and consent to use, especially where a child or another family member appears in the photo.",
          ],
        },
        {
          title: "Payments",
          body: [
            "We do not store credit card, debit card, UPI, net banking, or other full payment instrument details on Hero Kids Universe servers.",
            "Payments may be handled through third-party payment providers. We may store payment status, transaction reference, amount, currency, refund status, and order reference so we can provide receipts, support, refunds, and fraud prevention.",
          ],
        },
        {
          title: "How we use information",
          body: [
            "We use your information to create and manage accounts, generate stories and avatars, remember universe continuity, process orders, provide customer support, prevent misuse, improve product reliability, and comply with legal obligations.",
            "We may use aggregated or anonymized operational information to understand service performance, cost, errors, and product usage. This does not identify individual children or families.",
          ],
        },
        {
          title: "Sharing of information",
          body: [
            "We do not sell personal information. We may share limited information with service providers who help us run the service, including hosting, storage, AI generation, payment processing, analytics, customer support, delivery, printing, and security providers.",
            "We may disclose information when required by law, court order, government request, enforcement of our Terms, prevention of fraud or abuse, or protection of users and the platform.",
          ],
        },
        {
          title: "Children and parents",
          body: [
            "Hero Kids Universe is designed for families and children, but accounts and purchases should be created and managed by a parent, guardian, or responsible adult.",
            "Parents or guardians can contact us to request help with reviewing, correcting, exporting, or deleting account information where legally and technically possible.",
          ],
        },
        {
          title: "Data retention and deletion",
          body: [
            "We keep account, story, universe, generated asset, transaction, and order information for as long as needed to provide the service, support the user, comply with accounting or legal obligations, resolve disputes, and protect the platform.",
            "You may request deletion of your account or specific content by emailing support@accurateitsolution.in. Some records, such as invoices, payments, order history, dispute records, and legal logs, may need to be retained as required by law or legitimate business needs.",
          ],
        },
        {
          title: "Security",
          body: [
            "We use reasonable technical and organizational measures to protect user information. No internet service is completely risk-free, so please use a strong password and keep account access private.",
            "If you believe your account or data has been accessed without permission, contact us immediately at support@accurateitsolution.in.",
          ],
        },
        {
          title: "Updates to this policy",
          body: [
            "We may update this Privacy Policy as the product, law, or business changes. The updated date on this page will show when the latest version became effective.",
          ],
        },
      ]}
    />
  );
}
