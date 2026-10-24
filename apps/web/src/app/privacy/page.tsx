import type { Metadata } from "next";

import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for Hero Kids Universe by Accurate IT Solution.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      description="How Hero Kids Universe handles your account, your child's details and photos, the stories our AI creates, payments, and orders."
      updatedAt="21 October 2026"
      sections={[
        {
          title: "Who we are",
          body: [
            "Hero Kids Universe is operated by Accurate IT Solution, 136 Industrial Area Phase-2, Panchkula, Haryana, 134113, India (\"we\", \"us\").",
            "For anything about privacy, your data, or this policy, write to support@herokidsuniverse.com. This address also reaches our Grievance Officer (see \"Questions and complaints\" below).",
          ],
        },
        {
          title: "A service for parents, about children",
          body: [
            "Accounts are created and managed by a parent or legal guardian. Children do not sign up or log in themselves.",
            "When you sign up you confirm that you are the parent or legal guardian of the children whose details and photos you add, and you consent to us processing that information as described in this policy. We record when you gave this consent.",
            "If you add other family members or friends (for example grandparents or cousins), please only do so with their permission, or their guardian's permission for a child.",
          ],
        },
        {
          title: "What we collect",
          body: [
            "Account details: your name, email address, password (stored only as a secure hash), and optionally a phone number.",
            "Details about your hero and characters: names, dates of birth (to keep their age right in the pictures), gender, relationship to the hero, costume or appearance notes, and the story ideas you type.",
            "What we create for you: the cartoon avatars, a short written description of each character's appearance (for example hair style, skin tone, glasses) used to draw them consistently, stories, illustrations, narration audio, videos, PDFs, and your universe's history (quests, villains, gear earned).",
            "Purchases and orders: credit packs bought, coupon codes used, payment status and references, and for physical orders the delivery name, phone number and address.",
            "Basic technical records such as log entries and error reports, kept to run and secure the service.",
          ],
        },
        {
          title: "Photos you upload",
          body: [
            "A photo is used only to create a cartoon avatar and the appearance description above. It is processed in memory and sent to our AI providers for that purpose. We do not store the original photo on our servers or in our storage.",
            "We keep the cartoon avatar and the appearance description, because they are needed to draw your characters in every story. You can replace or delete them at any time.",
            "Before an avatar is made, the photo is automatically checked to make sure it is a suitable family photo.",
            "Please upload only photos you have the right to use. We never use your photos or your child's information for advertising, and we never sell them.",
          ],
        },
        {
          title: "AI providers we use",
          body: [
            "Stories, pictures, avatars and narration, reading a character's appearance from the uploaded photo, and our quality and child-safety checks are all done by Google's Gemini artificial-intelligence services. We do not send your photos or your children's details to any other AI provider. If we add or change an AI provider, we will update this list.",
            "Google processes this data under its Gemini API terms for paid business use, which do not allow it to use the data to train or improve its models. Its servers may be located outside India.",
            "Voice typing: if you tap the 🎤 Speak button, your own browser's built-in speech service (Google in Chrome, Apple in Safari) turns your words into text. We receive only the text you see in the box — never the audio.",
          ],
        },
        {
          title: "Other service providers",
          body: [
            "We also use providers for hosting and storage (cloud servers and Cloudflare storage for images, audio and video files), payments (Razorpay), and email. They receive only what they need to provide their service to us.",
            "We do not sell personal information. We may disclose information when required by law, a court order or a government authority, or to prevent fraud, abuse or harm to a child.",
          ],
        },
        {
          title: "Payments",
          body: [
            "Payments are handled by Razorpay. We never see or store your card, UPI or net-banking details. We keep the payment status, amount, reference number and any coupon used, for receipts, refunds and accounting.",
          ],
        },
        {
          title: "Cookies and browser storage",
          body: [
            "We store a small amount of information in your browser to keep you signed in, to remember a coupon code you applied, and to remember messages you have dismissed.",
            "We do not use advertising cookies, and we do not use third-party analytics or tracking tools.",
          ],
        },
        {
          title: "How long we keep data",
          body: [
            "Your account, characters, avatars and stories are kept while your account is active, so your universe keeps working.",
            "When you delete a story, its pictures, narration audio and video are deleted too; when you delete a character, their avatar is deleted. When you ask us to delete your account, we delete your children's details, avatars, stories and other content. We keep only what the law requires, such as invoices and payment records, for the required period.",
          ],
        },
        {
          title: "Your rights",
          body: [
            "As the parent or guardian you can ask us to show you the information we hold, correct it, delete it, or withdraw your consent. Withdrawing consent means we will delete your children's information and you will no longer be able to create stories for them.",
            "Write to support@herokidsuniverse.com from your account's email address. We will reply within 30 days.",
          ],
        },
        {
          title: "Security",
          body: [
            "We use encrypted connections, hashed passwords, access controls and limited staff access to protect your information. No online service is completely risk-free, so please keep your password private.",
            "If we become aware of a data breach that affects you, we will inform you and the authorities as the law requires. If you think your account has been accessed without permission, contact us straight away.",
          ],
        },
        {
          title: "Questions and complaints",
          body: [
            "Grievance Officer, Accurate IT Solution, 136 Industrial Area Phase-2, Panchkula, Haryana, 134113, India. Email: support@herokidsuniverse.com. We acknowledge complaints within 2 working days and aim to resolve them within 30 days.",
            "If you are not satisfied with our answer, you may approach the Data Protection Board of India.",
          ],
        },
        {
          title: "Changes to this policy",
          body: [
            "If we change this policy in an important way, we will tell you by email or in the app before the change applies. The date at the top shows the latest version.",
          ],
        },
      ]}
    />
  );
}
