import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/cross-reference?root_a=صلو&root_b=زكو
 * Returns ayahs that contain both roots simultaneously.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const rootA = searchParams.get("root_a")?.trim();
    const rootB = searchParams.get("root_b")?.trim();

    if (!rootA || !rootB) {
        return NextResponse.json({ error: "root_a and root_b params are required" }, { status: 400 });
    }

    try {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("cross_reference_roots", {
            root_a: rootA,
            root_b: rootB,
        });
        if (error) throw error;

        return NextResponse.json({ ayahs: data ?? [] });
    } catch (err) {
        console.error("[/api/cross-reference]", err);
        return NextResponse.json({ error: "Cross-reference query failed" }, { status: 500 });
    }
}
