import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";

interface LegalSection {
  title: string;
  body: string[];
}

interface LegalPageProps {
  eyebrow: string;
  title: string;
  description: string;
  updatedAt: string;
  sections: LegalSection[];
  children?: React.ReactNode;
}

export default function LegalPage({
  eyebrow,
  title,
  description,
  updatedAt,
  sections,
  children,
}: LegalPageProps) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream">
        <section className="bg-page-header pt-36 pb-16 px-6 text-white">
          <div className="mx-auto max-w-4xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-gold">{eyebrow}</p>
            <h1 className="font-[family-name:var(--font-display)] text-5xl leading-none md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 md:text-lg">
              {description}
            </p>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              Last updated: {updatedAt}
            </p>
          </div>
        </section>

        <section className="px-6 py-14">
          <div className="mx-auto grid max-w-4xl gap-6">
            {children}
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-3xl border border-ink/10 bg-white p-6 shadow-card md:p-8"
              >
                <h2 className="font-[family-name:var(--font-display)] text-3xl leading-none text-ink">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-ink-mid md:text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
