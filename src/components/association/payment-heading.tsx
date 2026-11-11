export function PaymentHeading({ title, description, association, logo, banner }: { title: string; description?: string | null; association?: string | null; logo?: string | null; banner?: string | null }) {
  return <section className="mt-6 space-y-4">
    {banner && <img src={banner} alt={`${title} banner`} className="aspect-[3/1] w-full rounded-lg object-cover" />}
    <div className="flex items-center gap-3">{logo && <img src={logo} alt={`${association ?? "Association"} logo`} className="h-14 w-14 shrink-0 rounded-lg border bg-background object-contain p-1" />}<div className="min-w-0">{association && <p className="text-sm text-muted-foreground break-words">{association}</p>}<h1 className="font-display text-2xl font-bold break-words">{title}</h1></div></div>
    {description && <p className="whitespace-pre-line break-words text-muted-foreground">{description}</p>}
  </section>;
}