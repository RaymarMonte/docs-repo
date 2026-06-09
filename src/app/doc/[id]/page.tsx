import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Editor } from "@/components/editor";
import { ShareDialog } from "@/components/share-dialog";

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

  const isOwner = doc.owner_id === user.id;

  // Owner edits unconditionally. For a shared-in user, the `documents` UPDATE
  // policy only allows saves on an `edit` share, so mirror that here to decide
  // read-only vs. editable. (RLS is the real gate; this just shapes the UI.)
  let canEdit = isOwner;
  let shares: { userId: string; email: string; permission: string }[] = [];

  if (isOwner) {
    // Owner-only: list current recipients to manage in the share dialog. The
    // `document_shares` SELECT policy lets the owner read these via
    // `is_document_owner`.
    //
    // Two-step read (NOT a `profiles(email)` embed): `document_shares.shared_with`
    // and `profiles.id` both FK to `auth.users(id)`, with no direct FK between the
    // two tables, so PostgREST can't resolve an embed and the query errors out to
    // an empty list. Fetch the shares, then resolve emails from the public
    // `profiles` table in a second query and join in memory.
    const { data: shareRows } = await supabase
      .from("document_shares")
      .select("shared_with, permission")
      .eq("document_id", id);

    const rows = shareRows ?? [];
    if (rows.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, email")
        .in(
          "id",
          rows.map((r) => r.shared_with),
        );

      const emailById = new Map(
        (profileRows ?? []).map((p) => [p.id, p.email]),
      );

      shares = rows.map((r) => ({
        userId: r.shared_with,
        email: emailById.get(r.shared_with) ?? "(unknown)",
        permission: r.permission,
      }));
    }
  } else {
    const { data: myShare } = await supabase
      .from("document_shares")
      .select("permission")
      .eq("document_id", id)
      .eq("shared_with", user.id)
      .maybeSingle();
    canEdit = myShare?.permission === "edit";
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← All documents
        </Link>
        {isOwner && <ShareDialog docId={doc.id} shares={shares} />}
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
