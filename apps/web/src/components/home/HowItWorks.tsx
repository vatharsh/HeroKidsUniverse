const steps = [
  {
    badge: "1",
    emoji: "📸",
    title: "Upload a Photo",
    body: "Add your child's photo. Our AI uses it to create a character that looks just like them — ready for any adventure.",
  },
  {
    badge: "2",
    emoji: "🎭",
    title: "Pick an Adventure",
    body: "Choose from 6 magical themes: space, superhero, jungle, ocean, mystery, or birthday.",
  },
  {
    badge: "3",
    emoji: "📖",
    title: "Get Your Storybook",
    body: "Receive a full illustrated comic with audio narration and a print-ready PDF — in minutes.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-brand text-xs font-bold tracking-widest uppercase mb-3">
            THE MAGIC PROCESS
          </p>
          <h2 className="font-[family-name:var(--font-display)] font-black text-ink text-4xl md:text-5xl mb-4">
            Three Steps to Your Child&apos;s Story
          </h2>
          <p className="text-ink-mid text-lg">
            Simple enough for anyone. Magical enough to remember forever.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.badge}
              className="relative bg-white rounded-2xl p-8 shadow-card text-center"
            >
              <div className="absolute -top-3 -left-3 bg-brand text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">
                {step.badge}
              </div>
              <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">{step.emoji}</span>
              </div>
              <h3 className="font-[family-name:var(--font-display)] font-bold text-ink text-xl mb-3">
                {step.title}
              </h3>
              <p className="text-ink-mid text-base leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
