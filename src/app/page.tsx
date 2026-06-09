import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createDocument } from "@/actions/documents";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { ImportButton } from "@/components/import-button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OwnedDoc {
  id: string;
  title: string | null;
  updated_at: string | null;
}

interface SharedRow {
  permission: string;
  documents:
    | { id: string; title: string | null; updated_at: string | null }
    | { id: string; title: string | null; updated_at: string | null }[]
    | null;
}

interface SharedDoc {
  id: string;
  title: string | null;
  updated_at: string | null;
  permission: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Owned documents
  const { data: ownedRaw } = await supabase
    .from("documents")
    .select("id, title, updated_at")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  const ownedDocs: OwnedDoc[] = (ownedRaw ?? []) as OwnedDoc[];

  // Documents shared with me
  const { data: sharedRaw } = await supabase
    .from("document_shares")
    .select("permission, documents(id, title, updated_at)")
    .eq("shared_with", user.id);

  const sharedDocs: SharedDoc[] = ((sharedRaw ?? []) as SharedRow[])
    .map((row) => {
      // The nested relation may come back as an object or a single-element array
      const doc = Array.isArray(row.documents)
        ? row.documents[0]
        : row.documents;
      if (!doc) return null;
      return { ...doc, permission: row.permission };
    })
    .filter((d): d is SharedDoc => d !== null);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur dark:bg-black/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <span className="text-base font-semibold tracking-tight">
            Docs Repo
          </span>
          <div className="flex items-center gap-2">
            <form action={createDocument}>
              <Button type="submit">New document</Button>
            </form>
            <ImportButton />
            <form action={signOut}>
              <Button variant="ghost" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Your documents */}
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold">Your documents</h2>
          {ownedDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents yet.{" "}
              <span className="font-medium text-foreground">
                Create one with &ldquo;New document&rdquo; above.
              </span>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ownedDocs.map((doc) => (
                <Link key={doc.id} href={`/doc/${doc.id}`} className="group">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <CardTitle className="truncate">
                        {doc.title ?? "Untitled"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>
                        Updated {formatDate(doc.updated_at)}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Shared with me */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Shared with me</h2>
          {sharedDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents have been shared with you yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sharedDocs.map((doc) => (
                <Link key={doc.id} href={`/doc/${doc.id}`} className="group">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <CardTitle className="truncate">
                        {doc.title ?? "Untitled"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>
                        <span className="capitalize">{doc.permission}</span>
                        {" · "}Updated {formatDate(doc.updated_at)}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
