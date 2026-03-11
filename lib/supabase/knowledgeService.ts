/**
 * Supabase knowledge service – server-side CRUD for tracked_roots.
 * Uses the browser Supabase client; RLS enforces user_id isolation.
 */

import { createClient } from "@/lib/supabase/client";
import type { TrackedRoot, KnowledgeState } from "@/lib/cache/knowledgeCache";

function supabaseRowToTrackedRoot(row: {
    root: string;
    state: string;
    notes: string;
    added_at: string;
    last_reviewed_at: string;
}): TrackedRoot {
    return {
        root: row.root,
        state: row.state as KnowledgeState,
        notes: row.notes,
        addedAt: new Date(row.added_at).getTime(),
        lastReviewedAt: new Date(row.last_reviewed_at).getTime(),
    };
}

/** Fetch all tracked roots for the signed-in user. */
export async function getTrackedRoots(): Promise<TrackedRoot[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("tracked_roots")
        .select("root, state, notes, added_at, last_reviewed_at")
        .order("added_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(supabaseRowToTrackedRoot);
}

/** Insert or update a root for the signed-in user. */
export async function upsertRoot(
    userId: string,
    root: string,
    state: KnowledgeState = "learning",
    notes = ""
): Promise<TrackedRoot> {
    const supabase = createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from("tracked_roots")
        .upsert(
            {
                user_id: userId,
                root,
                state,
                notes,
                added_at: now,
                last_reviewed_at: now,
            },
            { onConflict: "user_id,root", ignoreDuplicates: false }
        )
        .select("root, state, notes, added_at, last_reviewed_at")
        .single();

    if (error) throw new Error(error.message);
    return supabaseRowToTrackedRoot(data);
}

/** Partial update (state and/or notes) for an already-tracked root. */
export async function updateRoot(
    root: string,
    patch: Partial<Pick<TrackedRoot, "state" | "notes">>
): Promise<TrackedRoot> {
    const supabase = createClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
        .from("tracked_roots")
        .update({ ...patch, last_reviewed_at: now })
        .eq("root", root)
        .select("root, state, notes, added_at, last_reviewed_at")
        .single();

    if (error) throw new Error(error.message);
    return supabaseRowToTrackedRoot(data);
}

/** Remove a tracked root for the signed-in user. */
export async function removeRoot(root: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
        .from("tracked_roots")
        .delete()
        .eq("root", root);

    if (error) throw new Error(error.message);
}

/** Bulk upsert – used for migrating roots from IndexedDB on first sign-in. */
export async function batchUpsertRoots(
    userId: string,
    roots: TrackedRoot[]
): Promise<number> {
    if (roots.length === 0) return 0;
    const supabase = createClient();

    const rows = roots.map((r) => ({
        user_id: userId,
        root: r.root,
        state: r.state,
        notes: r.notes,
        added_at: new Date(r.addedAt).toISOString(),
        last_reviewed_at: new Date(r.lastReviewedAt).toISOString(),
    }));

    const { error } = await supabase
        .from("tracked_roots")
        .upsert(rows, { onConflict: "user_id,root", ignoreDuplicates: false });

    if (error) throw new Error(error.message);
    return rows.length;
}
