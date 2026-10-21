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
      description="The rules for using Hero Kids Universe: AI-generated content, child safety, credits, coupons, orders and refunds."
      updatedAt="21 October 2026"
      sections={[
        {
          title: "Agreement",
          body: [
            "These Terms apply to Hero Kids Universe, operated by Accurate IT Solution, 136 Industrial Area Phase-2, Panchkula, Haryana, 134113, India (\"we\", \"us\").",
            "By creating an account, generating content, buying credits or placing an order, you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use the service.",
          ],
        },
        {
          title: "Who may use the service",
          body: [
            "Accounts must be created and managed by an adult who is the parent or legal guardian of the children whose details and photos are added. Children may enjoy the stories, but should not create accounts, make purchases or upload content themselves.",
            "You are responsible for keeping your login details safe and for everything done through your account.",
          ],
        },
        {
          title: "All stories, pictures and narration are made by AI",
          body: [
            "Every story, illustration, avatar, narration, video and other item on Hero Kids Universe is created automatically by artificial intelligence (AI). It is not written, drawn or reviewed by a person before you see it.",
            "AI can make mistakes. Content may contain errors, odd or inaccurate details, spelling or grammar slips, unexpected events, or pictures that do not look exactly like the real person. Avatars and illustrations are artistic interpretations, not accurate likenesses, and narration voices are synthetic.",
            "We use automated child-safety checks on everything you type, every photo you upload, and every story and picture that is created (see \"Child safety\" below). No automated system is perfect, so you agree to read and look through each story yourself before sharing it with a child or anyone else, and to stop using any content you find unsuitable.",
            "Stories are for entertainment only. They are not educational, medical, psychological or professional advice, and they may not be factually accurate about real places, animals, science, history or cultures.",
            "To the fullest extent allowed by law, we are not liable for the content created by AI, for how it is understood, or for any loss, distress or harm arising from relying on, sharing or displaying it. This does not limit any rights you have that cannot be excluded under Indian law.",
          ],
        },
        {
          title: "Child safety",
          body: [
            "Hero Kids Universe is built for children aged 4–12. Story ideas, names and descriptions you type are checked, and requests for sexual content, graphic violence, cruelty, insults, hate, swearing, drugs, alcohol, smoking or self-harm are refused.",
            "Uploaded photos are checked before an avatar is made. Every generated story and picture is checked as well; if it does not pass, it is redrawn or rewritten once, and if it still does not pass the story is stopped and its credit is returned to you.",
            "If you ever see something unsuitable, please email support@accurateitsolution.in with the story name. We will look into it, remove it where needed, and return the credit used.",
          ],
        },
        {
          title: "Your content and permissions",
          body: [
            "You are responsible for the names, photos, story ideas and other details you submit. You must have the right to use them, and the permission of anyone else shown or named (or their guardian's permission for a child).",
            "You give us permission to use what you submit only to provide the service: creating avatars, stories, illustrations, narration, videos, PDFs and merchandise, checking them for safety, and supporting you.",
            "You may not upload photos of people without their consent, of celebrities or public figures, or anything unlawful, sexual, violent or hateful. We may refuse, remove or block such content and suspend accounts that misuse the service.",
          ],
        },
        {
          title: "Who owns the stories",
          body: [
            "You may use the stories, pictures, narration and videos created for your account for personal and family purposes: reading, printing at home, gifting and sharing with family and friends.",
            "Commercial use (for example selling the stories, pictures or books) is not allowed without our written permission. The Hero Kids Universe name, logo, website and software belong to us.",
            "Because content is made by AI, similar stories or pictures may sometimes be created for other users, and we cannot guarantee that content is unique.",
          ],
        },
        {
          title: "Credits, packs and coupons",
          body: [
            "Story Credits are used to create stories; Character Slots and Avatar Refreshes are sold separately. Prices, pack contents, page counts and features may change, and the current details are shown before you pay.",
            "A credit is used when a story is created. If a story fails to generate or is stopped by our safety checks, the credit is returned automatically. A story that is created successfully but that you simply do not like uses the credit.",
            "Credits, slots and refreshes have no cash value and cannot be transferred or exchanged for money.",
            "Coupon codes (including codes shared by influencers) can be used when buying credit packs and in the store. Only one coupon applies per purchase. Coupon discounts on credit packs are limited to a maximum percentage that is shown at checkout. Coupons may have minimum order amounts, usage limits and expiry dates, and we may withdraw a coupon that is misused.",
          ],
        },
        {
          title: "Orders, merchandise and delivery",
          body: [
            "Merchandise may include printed storybooks, apparel, posters, stickers and other personalised products made from your stories and pictures. Please check names, spelling and pictures before ordering, as products are printed exactly as shown.",
            "For physical orders you must give a correct delivery address and phone number. We are not responsible for delays or failed delivery caused by incorrect details.",
            "Because products are personalised, cancellation, changes, replacement or refund may not be possible once production has started, unless the product arrives damaged or defective or the law requires otherwise.",
          ],
        },
        {
          title: "Payments and refunds",
          body: [
            "Payments are processed by Razorpay. We do not store card, UPI or net-banking details.",
            "Digital purchases (credits, slots, refreshes) are generally non-refundable once delivered to your account, except where a payment was taken but the purchase did not reach your account, or where the law requires a refund. For help with a payment or refund, contact support@accurateitsolution.in.",
          ],
        },
        {
          title: "Acceptable use",
          body: [
            "You must not misuse the service: no attempts at unauthorised access, scraping, reverse engineering, getting around limits or safety checks, abusing coupons or free offers, impersonating others, or creating content that harms, sexualises, bullies or exploits any child or person.",
            "We may suspend or close accounts that break these Terms, and we report suspected child exploitation to the authorities.",
          ],
        },
        {
          title: "Availability and changes",
          body: [
            "We aim to keep Hero Kids Universe running smoothly, but it may be interrupted by maintenance, AI provider limits or outages, payment provider issues or other events outside our control.",
            "We may add, change or remove features, prices and content as the service develops. If we change these Terms in an important way, we will tell you before the change applies.",
          ],
        },
        {
          title: "Limitation of liability",
          body: [
            "The service and everything created by it are provided \"as is\". To the fullest extent allowed by law, Hero Kids Universe and Accurate IT Solution are not liable for indirect, incidental, special or consequential losses, loss of data, or loss of profits arising from use of the service or of AI-generated content.",
            "Our total liability for any claim is limited to the amount you paid for the specific purchase the claim relates to, unless the law requires a higher amount.",
          ],
        },
        {
          title: "Governing law",
          body: [
            "These Terms are governed by the laws of India. Disputes are subject to the jurisdiction of the courts at Panchkula, Haryana, India.",
          ],
        },
        {
          title: "Contact",
          body: [
            "Questions about these Terms, content, payments, orders or your account: support@accurateitsolution.in.",
          ],
        },
      ]}
    />
  );
}
