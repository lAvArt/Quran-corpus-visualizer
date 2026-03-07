import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/collocations?root=فعل&window=ayah&min_pmi=1.0&limit=20
 * Returns roots that co-occur with the given root, sorted by PMI.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const root = searchParams.get("root")?.trim();

    if (!root) {
        return NextResponse.json({ error: "root param is required" }, { status: 400 });
    }

    const windowType = searchParams.get("window") ?? "ayah";
    const minPmi = Number(searchParams.get("min_pmi") ?? "1.0");
    const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);

    try {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("get_collocates", {
            target_root: root,
            window_type: windowType,
            min_pmi: minPmi,
            limit_n: limit,
        });
        if (error) throw error;

        return NextResponse.json({ collocates: data ?? [] });
    } catch (err) {
        console.error("[/api/collocations]", err);
        return NextResponse.json({ error: "Collocation query failed" }, { status: 500 });
    }
}
