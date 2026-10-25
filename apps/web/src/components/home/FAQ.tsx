"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePreviewPages } from "@/lib/platform-settings";

const faqs = [
  {
    q: "How old does my child need to be?",
    a: "Hero Kids Universe is designed for children aged 4 to 12. The stories, illustrations, and narration are all tailored to be age-appropriate and engaging for this range.",
  },
  {
    q: "How long does it take to generate a story?",
    a: "Usually about 3–7 minutes. Our AI writes the story, illustrates every page, checks it for child safety and records the narration. You don't need to wait on the page — we email you the moment it's ready.",
  },
  {
    q: "Is my child's photo stored on your servers?",
    a: "No. We use the photo only to generate a unique illustrated avatar of your child. The original photo is never stored on our servers. Only the avatar is used in your stories.",
  },
  {
    q: "Can I print the storybook?",
    a: "Yes. Open any story and tap PDF to save all its pages as a PDF, then print it at home or at a print shop. You can also make a video of the story to share on WhatsApp.",
  },
  {
    q: "What are credits and do they expire?",
    a: "1 credit = 1 complete story: illustrated pages, narration, and PDF and video downloads. Credits never expire — use them whenever you like. If a story ever fails, the credit comes back automatically.",
  },
  {
    q: "Do the stories continue from one to the next?",
    a: "Yes — that's what makes Hero Kids Universe different. Your child's universe remembers everything: powers and gear they've earned, friends they've met, quests still open, and villains who escaped. Each new episode picks up from there, so the adventure keeps growing.",
  },
  {
    q: "Can I add family members or pets to the stories?",
    a: "Yes! You can build a full cast — dad, mum, siblings, grandparents, a best friend, even the family dog or cat. When creating a story, choose which characters appear alongside your child.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every new account gets a free {pages}-page preview story — no credit card needed. If you love it (you will), full stories start at ₹149.",
  },
];

export default function FAQ() {
  const previewPages = usePreviewPages();
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
                  {faq.a.replace("{pages}", String(previewPages))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
