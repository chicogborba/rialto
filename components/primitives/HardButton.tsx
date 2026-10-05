import { cn } from "@/lib/utils";

interface HardButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "pay";
  size?: "md" | "lg";
}

const VARIANTS: Record<NonNullable<HardButtonProps["variant"]>, string> = {
  primary: "bg-signal text-ink border-signal shadow-[4px_4px_0_var(--color-paper)]",
  pay: "bg-pay text-ink border-pay shadow-[4px_4px_0_var(--color-paper)]",
  ghost: "bg-transparent text-paper border-line-hi shadow-[4px_4px_0_var(--color-line)]",
};

/** Mechanical button: presses 2px down/right, shadow collapses. */
export function HardButton({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: HardButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 border font-mono font-bold uppercase tracking-[0.1em]",
        "transition-[transform,box-shadow] duration-75 ease-out",
        "active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--color-paper)]",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "md" ? "px-4 text-xs" : "px-6 py-3 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
