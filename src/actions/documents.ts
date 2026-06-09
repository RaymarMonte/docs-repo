"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Document mutations. Mirrors the shape of `auth.ts`:
 *   - `await createClient()` (async in Next 16 — it awaits `cookies()`).
 *   - `redirect()` throws NEXT_REDIRECT, so it stays OUTSIDE any try/catch.
 *
 * Authorization is enforced by RLS, not by checks here. In particular
 * `saveDocument` deliberately has no owner check — the `documents` UPDATE policy
 * allows `owner_id = auth.uid() OR an edit-share`, so editor-shared users must be
 * able to save. Re-adding an owner guard in code would silently break sharing.
 */
export type SaveState = { error: string } | undefined;

/**
 * Create a blank document owned by the current user and jump straight into it.
 * `owner_id` is set explicitly: the INSERT policy is `WITH CHECK owner_id =
 * auth.uid()`, so omitting it is a silent row-level-security rejection (42501).
 */
export async function createDocument(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("documents")
    .insert({ owner_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create document.");
  }

  revalidatePath("/", "layout");
  redirect(`/doc/${data.id}`);
}

/**
 * Create a document from an imported file (PLAN.md §4). Same shape as
 * `createDocument` — sets `owner_id` explicitly (INSERT policy `WITH CHECK
 * owner_id = auth.uid()`) and redirects into the new doc — but carries the parsed
 * title + sanitized HTML. Kept separate from `createDocument` so the dashboard's
 * zero-arg form action stays intact. `redirect()` throws NEXT_REDIRECT, so it
 * stays OUTSIDE any try/catch.
 */
export async function importDocument(
  title: string,
  html: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("documents")
    .insert({ owner_id: user.id, title: title.trim() || "Untitled", content: html })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not import document.");
  }

  revalidatePath("/", "layout");
  redirect(`/doc/${data.id}`);
}

/**
 * Rename a document. Autosaved (debounced) from the editor title field, so it
 * revalidates the dashboard where the title is shown.
 */
export async function renameDocument(
  id: string,
  title: string,
): Promise<SaveState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ title: title.trim() || "Untitled", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/", "layout");
}

/**
 * Persist editor HTML. Called repeatedly from the ~800ms autosave debounce, so it
 * intentionally does NOT revalidate any path — the client already holds the
 * latest content, and revalidating the dashboard on every keystroke-debounce is
 * wasteful. Dashboard ordering catches up on the next rename/create/navigation.
 */
export async function saveDocument(id: string, html: string): Promise<SaveState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("documents")
    .update({ content: html, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { error: error.message };
}

/**
 * Delete a document. The DELETE policy restricts this to the owner; a non-owner
 * call affects zero rows rather than erroring.
 */
export async function deleteDocument(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
