import type { Metadata } from "next";
import { Mail, MapPin, Scale, ShieldCheck } from "lucide-react";

import LegalPage from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Contact | Hero Kids Universe",
  description: "Contact Accurate IT Solution for Hero Kids Universe support.",
};

const contactCards = [
  {
    icon: Mail,
    title: "Support Email",
    value: "support@accurateitsolution.in",
    href: "mailto:support@accurateitsolution.in",
  },
  {
    icon: MapPin,
    title: "Company Address",
    value: "136 Industrial Area Phase-2, Panchkula, Haryana, 134113",
  },
  {
    icon: ShieldCheck,
    title: "Company",
    value: "Accurate IT Solution",
  },
  {
    icon: Scale,
    title: "Jurisdiction",
    value: "District and Sessions Court, Panchkula",
    href: "https://panchkula.dcourts.gov.in/",
  },
];

export default function ContactPage() {
  return (
    <LegalPage
      eyebrow="Contact"
      title="Contact Us"
      description="Need help with your Hero Kids Universe account, story generation, credits, merchandise order, privacy request, or payment issue? Reach us here."
      updatedAt="26 June 2026"
      sections={[
        {
          title: "Support requests",
          body: [
            "For the fastest help, email support@accurateitsolution.in with your registered email address, order number if applicable, and a short description of the issue.",
            "Please do not email full payment card details, OTPs, passwords, or other sensitive authentication information. We will never ask you to share your password or payment credentials over email.",
          ],
        },
        {
          title: "What we can help with",
          body: [
            "We can help with account access, story generation issues, avatar or character questions, credit balance questions, merchandise orders, shipping updates, payment references, refund requests, privacy requests, and general product support.",
            "If your request relates to a child profile, uploaded photo, generated avatar, or story content, please include enough detail for us to identify the account or item without sending unnecessary personal information.",
          ],
        },
        {
          title: "Business and legal notices",
          body: [
            "Business, legal, privacy, and formal notices may be sent to Accurate IT Solution at the address listed on this page or by email at support@accurateitsolution.in.",
            "All cases and legal proceedings are subject to the jurisdiction of the District and Sessions Court, Panchkula, Haryana, India.",
          ],
        },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {contactCards.map((card) => {
          const Icon = card.icon;
          const content = (
            <div className="flex h-full gap-4 rounded-3xl border border-ink/10 bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-brand">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-ink-muted">{card.title}</p>
                <p className="mt-2 text-base font-bold leading-6 text-ink">{card.value}</p>
              </div>
            </div>
          );

          return card.href ? (
            <a key={card.title} href={card.href} target={card.href.startsWith("http") ? "_blank" : undefined} rel={card.href.startsWith("http") ? "noreferrer" : undefined}>
              {content}
            </a>
          ) : (
            <div key={card.title}>{content}</div>
          );
        })}
      </div>
    </LegalPage>
  );
}
