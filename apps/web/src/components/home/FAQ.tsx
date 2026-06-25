"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const faqs = [
  {
    q: "How old does my child need to be?",
    a: "Hero Kids Universe is designed for children aged 4 to 12. The stories, illustrations, and narration are all tailored to be age-appropriate and engaging for this range.",
  },
  {
    q: "How long does it take to generate a story?",
    a: "Most stories are ready in 2–4 minutes. Our AI generates the text, creates illustrated pages, records the narration, and assembles your PDF — all automatically.",
  },
  {
    q: "Is my child's photo stored on your servers?",
    a: "No. We use the photo only to generate a unique illustrated avatar of your child. The original photo is never stored on our servers. Only the avatar is used in your stories.",
  },
  {
    q: "Can I print the storybook?",
    a: "Absolutely — every story comes as a print-ready PDF. You can print it at home or at any print shop. The pages are sized for A4 and US Letter.",
  },
  {
    q: "What are credits and do they expire?",
    a: "1 credit = 1 complete story (cover, 8 illustrated pages, narration, PDF). Credits never expire — use them whenever you like.",
  },
  {
    q: "Can I add family members or pets to the stories?",
    a: "Yes! You can build a full cast — dad, mum, siblings, grandparents, a best friend, even the family dog or cat. When creating a story, choose which characters appear alongside your child.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. You can generate one sample story page completely free — no account or credit card required. If you love it (you will), create a full story from ₹149.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-24 bg-cream" id="faq">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-brand text-xs font-bold tracking-widest uppercase mb-3">
            GOT QUESTIONS?
          </p>
          <h2 className="font-[family-name:var(--font-display)] font-black text-ink text-4xl md:text-5xl mb-4">
            We&apos;ve Got Answers
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl overflow-hidden shadow-card"
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left gap-4"
              >
                <span className="font-[family-name:var(--font-display)] font-bold text-ink text-base">
                  {faq.q}
                </span>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-brand flex-shrink-0 transition-transform duration-200",
                    open === i && "rotate-180",
                  )}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-6 text-ink-mid text-sm leading-relaxed border-t border-ink/5 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
