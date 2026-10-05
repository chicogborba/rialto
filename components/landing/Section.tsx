import { Label } from "@/components/primitives";
import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  index: string;
  title: React.ReactNode;
  light?: boolean;
  intro?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Section({ id, index, title, light, intro, className, children }: SectionProps) {
  const headingId = `${id ?? index.replace(/\W+/g, "-")}-title`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-4 border-t border-line", light && "section-light border-ink/20", className)}>
      <div className="mx-auto max-w-[1440px] px-4 py-16 md:px-8 md:py-24">
        <Label tone={light ? "ink" : "signal"}>{index}</Label>
        <h2 id={headingId} className="mt-3 max-w-5xl text-[clamp(2rem,5vw,4.5rem)] font-bold uppercase leading-[0.92] tracking-[-0.04em]">
          {title}
        </h2>
        {intro ? <p className={cn("mt-5 max-w-2xl text-lg", light ? "text-ink/70" : "text-muted")}>{intro}</p> : null}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}
