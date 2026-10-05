import { Label } from "./Label";

export function PageHeader({ index, title, children }: { index: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 border-b border-line pb-4">
      <Label tone="signal">{index}</Label>
      <h1 className="mt-2 text-3xl font-bold uppercase leading-none tracking-tighter md:text-5xl">{title}</h1>
      {children ? <p className="mt-3 max-w-2xl text-sm text-muted">{children}</p> : null}
    </header>
  );
}
