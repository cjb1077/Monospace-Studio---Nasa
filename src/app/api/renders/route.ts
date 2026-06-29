import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("renders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, code: "SERVER" },
        { status: 500 }
      );
    }

    const renders = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      ascii: row.ascii,
      caption: row.caption,
      funFact: row.fun_fact,
      sourceDate: row.source_date,
      isPublic: row.is_public,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ ok: true, renders }, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/renders error:", err);
    return NextResponse.json(
      { ok: false, error: "An unexpected server error occurred.", code: "SERVER" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required to save renders.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { title, ascii, caption, funFact, sourceDate, isPublic } = body;

    if (!title || !ascii || !sourceDate) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields (title, ascii, sourceDate).", code: "BAD_DATE" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("renders")
      .insert({
        user_id: user.id,
        title,
        ascii,
        caption: caption || "",
        fun_fact: funFact || "",
        source_date: sourceDate,
        is_public: !!isPublic,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, code: "SERVER" },
        { status: 500 }
      );
    }

    const render = {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      ascii: data.ascii,
      caption: data.caption,
      funFact: data.fun_fact,
      sourceDate: data.source_date,
      isPublic: data.is_public,
      createdAt: data.created_at,
    };

    return NextResponse.json({ ok: true, render }, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/renders error:", err);
    return NextResponse.json(
      { ok: false, error: "An unexpected server error occurred.", code: "SERVER" },
      { status: 500 }
    );
  }
}
