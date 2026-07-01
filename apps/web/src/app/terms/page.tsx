import type { Metadata } from "next";

import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms and Conditions | Hero Kids Universe",
  description: "Terms and Conditions for Hero Kids Universe by Accurate IT Solution.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms and Conditions"
      description="The rules for using Hero Kids Universe, creating stories, buying credits, and ordering merchandise."
      updatedAt="26 June 2026"
      sections={[
        {
          title: "Agreement",
          body: [
            "These Terms and Conditions apply to Hero Kids Universe, operated by Accurate IT Solution, 136 Industrial Area Phase-2, Panchkula, Haryana, 134113, India.",
            "By creating an account, using the website, generating content, buying credits, or placing an order, you agree to these Terms. If you do not agree, please do not use the service.",
          ],
        },
        {
          title: "Who may use the service",
          body: [
            "Hero Kids Universe is a family product. Accounts, payments, and orders should be created and managed by an adult parent, guardian, or authorized user.",
            "You are responsible for keeping your login details secure and for all activity that happens through your account.",
          ],
        },
        {
          title: "User content and permissions",
          body: [
            "You are responsible for the names, photos, story prompts, character details, addresses, and other information you submit. You must have the right and consent to upload or use that information.",
            "By submitting content, you give us permission to process it only as needed to provide Hero Kids Universe features, including generating avatars, stories, illustrations, narration, printable assets, merchandise previews, customer support, and order fulfilment.",
          ],
        },
        {
          title: "Generated stories and illustrations",
          body: [
            "Hero Kids Universe uses automated and AI-assisted tools to create personalized stories, avatars, illustrations, narration, and related assets. Results may vary and may not always be perfect, accurate, or identical to a real person.",
            "Generated content is for personal, family, entertainment, gifting, and permitted merchandise use through the platform. You should review generated content before sharing it with children or others.",
            "We may refuse, modify, remove, or block content that appears unsafe, unlawful, abusive, infringing, misleading, discriminatory, explicit, harmful to children, or otherwise unsuitable for the platform.",
          ],
        },
        {
          title: "Credits, packs, and subscriptions",
          body: [
            "Story Credits are used for story generation only. Character Slots, Avatar Refreshes, merchandise, and other paid features may be priced and managed separately.",
            "Plan benefits, credit packs, page counts, character limits, avatar refresh limits, prices, discounts, and features may change from time to time. Any displayed plan or purchase page will show the current applicable details.",
            "Credits or digital benefits may be consumed once a generation or service request starts, even if the final output requires review or regeneration due to normal creative variation.",
          ],
        },
        {
          title: "Orders, merchandise, and delivery",
          body: [
            "Merchandise orders may include physical or digital products such as storybooks, apparel, posters, certificates, stickers, or other customized products.",
            "For physical orders, you must provide accurate delivery details. We are not responsible for failed or delayed delivery caused by incorrect or incomplete address information provided by the user.",
            "Customized products are made using user-selected or generated content. Once production begins, cancellation, modification, replacement, or refund may be limited unless required by applicable law or confirmed by us in writing.",
          ],
        },
        {
          title: "Payments and refunds",
          body: [
            "Payments are processed through third-party payment providers or other supported payment methods. We do not store full payment instrument details such as card numbers or UPI credentials.",
            "Refunds, if applicable, will depend on the product, stage of order, payment status, digital usage, customization status, and applicable law. To request help with a payment or refund, contact support@accurateitsolution.in.",
          ],
        },
        {
          title: "Acceptable use",
          body: [
            "You must not misuse the service, attempt unauthorized access, reverse engineer systems, scrape data, upload harmful files, submit illegal or harmful content, impersonate others, violate privacy rights, or use the service to create content that harms children or any person.",
            "We may suspend or terminate access if we believe an account is being misused, violates these Terms, creates legal risk, or harms users, service providers, or the platform.",
          ],
        },
        {
          title: "Availability and changes",
          body: [
            "We aim to keep Hero Kids Universe reliable, but the service may be interrupted by maintenance, provider outages, AI service limits, payment provider issues, network problems, or other events outside our control.",
            "We may add, remove, modify, suspend, or discontinue features, pricing, designs, content, or integrations as the platform evolves.",
          ],
        },
        {
          title: "Limitation of liability",
          body: [
            "To the maximum extent permitted by law, Hero Kids Universe and Accurate IT Solution are not liable for indirect, incidental, special, consequential, punitive, or loss-of-profit damages arising from use of the service.",
            "Our total liability for any claim related to the service will be limited to the amount paid by you for the specific product or service giving rise to the claim, unless a higher amount is required by applicable law.",
          ],
        },
        {
          title: "Governing law and jurisdiction",
          body: [
            "These Terms are governed by the laws of India.",
            "All disputes, claims, and legal proceedings will be subject to the jurisdiction of the District and Sessions Court, Panchkula, Haryana, India.",
          ],
        },
        {
          title: "Contact",
          body: [
            "For questions about these Terms, payments, orders, content, or account access, contact Accurate IT Solution at support@accurateitsolution.in.",
          ],
        },
      ]}
    />
  );
}
