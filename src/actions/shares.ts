"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Sharing mutations. Like the other action modules these run on the server and
 * lean on RLS for authorization — `shareDocument`/`unshareDocument` only succeed
 * for the document owner because the `document_shares` INSERT/DELETE policies are
 * gated by the `is_document_owner` helper (PLAN.md §RLS).
 *
 * Shaped for direct calls from a client transition (not `useActionState`), so
 * they return a discriminated result instead of redirecting.
 */
export type ShareState = { error: string } | { ok: true };

const PERMISSIONS = ["view", "edit"] as const;
type Permission = (typeof PERMISSIONS)[number];

/**
 * Share `docId` with the account that owns `email`, at `view` or `edit`.
 *
 * Resolution: `profiles` has a public SELECT policy (PLAN.md §5), so we can look
 * the recipient up by email even though they're a different user. Emails are
 * matched case-insensitively (`ilike`) — GoTrue stores them lower-cased, but the
 * recipient may type theirs with different casing.
 */
export async function shareDocument(
  docId: string,
  email: string,
  permission: string,
): Promise<ShareState> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { error: "Enter an email address to share with." };
  }
  if (!PERMISSIONS.includes(permission as Permission)) {
    return { error: "Invalid permission." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to share." };

  if (user.email?.toLowerCase() === normalizedEmail) {
    return { error: "You already own this document." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (!profile) {
    return {
      error: "No account found with that email. Ask them to sign up first.",
    };
  }

  // Delete-then-insert, NOT upsert. There is no UPDATE policy on
  // `document_shares` (PLAN.md §RLS defines only SELECT/INSERT/DELETE), so an
  // upsert's ON CONFLICT DO UPDATE path would be rejected with 42501. Removing
  // any existing share first keeps us on the owner-allowed DELETE+INSERT paths
  // and cleanly supports changing an existing recipient's permission level.
  await supabase
    .from("document_shares")
    .delete()
    .eq("document_id", docId)
    .eq("shared_with", profile.id);

  const { error } = await supabase.from("document_shares").insert({
    document_id: docId,
    shared_with: profile.id,
    permission,
  });

  if (error) return { error: error.message };

  revalidatePath(`/doc/${docId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Revoke a recipient's access. Owner-only via the `document_shares` DELETE policy
 * (`is_document_owner`); a non-owner call simply affects zero rows.
 */
export async function unshareDocument(
  docId: string,
  userId: string,
): Promise<ShareState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_shares")
    .delete()
    .eq("document_id", docId)
    .eq("shared_with", userId);

  if (error) return { error: error.message };

  revalidatePath(`/doc/${docId}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
