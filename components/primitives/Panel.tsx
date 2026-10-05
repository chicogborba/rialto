import { cn } from "@/lib/utils";
import { Label } from "./Label";

interface PanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  status?: React.ReactNode;
  selected?: boolean;
  tone?: "default" | "pay";
  bodyClassName?: string;
}

/** Hard-edged bordered container with a header strip. */
export function Panel({
  title,
  status,
  selected,
  tone = "default",
  className,
  bodyClassName,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        "border bg-surface text-paper",
        selected ? "border-signal shadow-hard" : "border-line",
        tone === "pay" && "border-pay bg-pay text-ink",
        className,
      )}
      {...props}
    >
      {(title || status) && (
        <header
          className={cn(
            "flex items-center justify-between gap-3 border-b px-3 py-2",
            tone === "pay" ? "border-ink/30" : "border-line",
          )}
        >
          <Label tone={tone === "pay" ? "ink" : "muted"}>{title}</Label>
          {status ? <div className="flex items-center gap-2">{status}</div> : null}
        </header>
      )}
      <div className={cn("p-3", bodyClassName)}>{children}</div>
    </section>
  );
}
