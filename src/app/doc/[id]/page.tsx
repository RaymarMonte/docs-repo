import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Editor } from "@/components/editor";

/**
 * Document editor route (RSC). Fetches the doc on the server and hands it to the
 * client `<Editor>`.
 *
 * Next 16: `params` is a Promise — it must be awaited (see NEXTJS16-CHEATSHEET §1).
 * Authorization is RLS: the SELECT policy only returns rows the user owns or has a
 * share on, so a hidden/missing doc simply yields no row → `notFound()`.
 */
export default async function DocPage(props: PageProps<"/doc/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: doc } = await supabase
    .from("documents")
    .select("id, title, content, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!doc) notFound();

  // Owner can always edit. Edit-shares are honoured by RLS on save; the sharing
  // block will widen this flag to cover them. Viewers stay read-only.
  const canEdit = doc.owner_id === user.id;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b px-4 py-2">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← All documents
        </Link>
      </header>
      <Editor
        id={doc.id}
        initialTitle={doc.title}
        initialContent={doc.content}
        canEdit={canEdit}
      />
    </div>
  );
}
