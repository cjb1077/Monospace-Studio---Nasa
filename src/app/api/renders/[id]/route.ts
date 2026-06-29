import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required to delete renders.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    // Perform deletion. Supabase RLS enforces that a user can only delete their own rows.
    const { error } = await supabase
      .from("renders")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, code: "SERVER" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/renders/[id] error:", err);
    return NextResponse.json(
      { ok: false, error: "An unexpected server error occurred.", code: "SERVER" },
      { status: 500 }
    );
  }
}
