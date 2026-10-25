import type { Metadata } from "next";

import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description: "When credits, payments and orders on Hero Kids Universe can be refunded or replaced.",
};

export default function RefundsPage() {
  return (
    <LegalPage
      eyebrow="Refunds"
      title="Refund and Cancellation Policy"
      description="Plain-English rules for credits, failed stories, payment problems and printed orders."
      updatedAt="25 October 2026"
      sections={[
        {
          title: "Credits are delivered instantly",
          body: [
            "Story credits, Character Slots and Avatar Refreshes are added to your account the moment your payment succeeds. Because they are delivered straight away, credit packs cannot be cancelled, and unused credits cannot be refunded for cash or exchanged for money.",
            "Credits never expire. Use them whenever you like.",
          ],
        },
        {
          title: "If a story goes wrong",
          body: [
            "If a story fails to generate or is stopped by our child-safety checks, its credit is returned to your account automatically.",
            "If a story is created but comes out wrong — for example the hero doesn't look like your child, pictures are broken, or the text doesn't make sense — email support@herokidsuniverse.com within 7 days with the story name. We'll check it and return the credit.",
            "A story that was created correctly but that you simply don't like uses the credit.",
          ],
        },
        {
          title: "Payment problems",
          body: [
            "If you were charged but your credits didn't arrive, or you were charged twice for the same purchase, email support@herokidsuniverse.com with your receipt number or payment reference. We'll add the missing credits or refund the extra payment.",
            "Approved refunds go back to your original payment method through Razorpay. Banks usually take 5–7 working days to show them. When a payment is refunded, the matching credits from that pack are removed from your account.",
          ],
        },
        {
          title: "Printed books and merchandise",
          body: [
            "Printed books and merchandise are made to order for your child, so they can't be cancelled or changed once production has started.",
            "If something arrives damaged or defective, email us within 7 days of delivery with a photo, and we'll replace it or refund it.",
          ],
        },
        {
          title: "How to reach us",
          body: [
            "Email support@herokidsuniverse.com with your receipt number. We reply within 2 working days.",
            "Hero Kids Universe is operated by Accurate IT Solution, 136 Industrial Area Phase-2, Panchkula, Haryana, 134113, India. This policy is part of our Terms and Conditions; where the law gives you more rights, the law applies.",
          ],
        },
      ]}
    />
  );
}
