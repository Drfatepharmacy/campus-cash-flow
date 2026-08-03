import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPublicAssociations, myAssociations } from "@/lib/associations.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Logo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/brand/footer";
import { Building2, Plus, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/associations/")({
  head: () => ({
    meta: [
      { title: "Associations on UniEgo — verified student bodies" },
      { name: "description", content: "Browse verified student associations collecting dues securely on UniEgo, or register your own association for platform verification." },
      { property: "og:title", content: "Associations on UniEgo" },
      { property: "og:description", content: "Verified student associations collecting dues securely on UniEgo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssociationsIndex,
});

function AssociationsIndex() {
  const fetchPublic = useServerFn(listPublicAssociations);
  const fetchMine = useServerFn(myAssociations);
  const publicList = useQuery({ queryKey: ["associations", "public"], queryFn: () => fetchPublic() });
  const mine = useQuery({ queryKey: ["associations", "mine"], queryFn: () => fetchMine(), retry: false });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link to="/"><Logo /></Link>
          <Button asChild size="sm"><Link to="/associations/new"><Plus className="h-4 w-4 mr-1" /> Register association</Link></Button>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl px-6 py-10 space-y-10 w-full">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Associations</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Every association on UniEgo is verified by the platform before it can collect a naira. Executives are appointed
            through review, not self-declared.
          </p>
        </div>

        {(mine.data ?? []).length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Your associations</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(mine.data ?? []).map((a: any) => (
                <Card key={a.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{a.name}</CardTitle>
                      <Badge variant={a.status === "active" ? "default" : "secondary"} className="capitalize shrink-0">
                        {String(a.status).replace("_", " ")}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">{a.institution}</p>
                    {a.roles?.length ? <p className="text-xs">Your role: <span className="font-medium capitalize">{a.roles.join(", ").replace(/_/g, " ")}</span></p> : null}
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link to="/association/$slug" params={{ slug: a.slug }}>Open workspace <ArrowRight className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Verified directory</h2>
          {publicList.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : (publicList.data ?? []).length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-3 opacity-50" />
              No associations have been verified yet. Yours could be the first.
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(publicList.data ?? []).map((a: any) => (
                <Card key={a.id}>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{a.name}</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">{a.institution}</p>
                    {a.description && <p className="text-sm line-clamp-3">{a.description}</p>}
                    <Badge variant="outline" className="capitalize">{a.type}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
