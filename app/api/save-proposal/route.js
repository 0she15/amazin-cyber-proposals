export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Server-only Supabase access via the service role key (bypasses RLS).
// Gated by the operator-auth middleware. The client never sees the key.

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// DB row -> UI history shape (matches what proposals.jsx expects)
function toEntry(r) {
  return {
    id: r.id,
    clientName: r.client_name || "",
    company: r.company || "",
    package: r.package || "",
    proposal: r.proposal_text || "",
    createdAt: r.created_at || "",
  }
}

export async function GET() {
  const db = admin()
  if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 })

  const { data, error } = await db
    .from("proposals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Load proposals failed:", error.message)
    return NextResponse.json({ error: "Could not load history" }, { status: 502 })
  }
  return NextResponse.json({ history: (data || []).map(toEntry) })
}

export async function POST(req) {
  const db = admin()
  if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const row = {
    lead_id: body.leadId || null,
    client_name: (body.clientName || "").toString().trim() || null,
    company: (body.company || "").toString().trim() || null,
    package: (body.package || "").toString().trim() || null,
    proposal_text: (body.proposal || "").toString() || null,
  }

  const { data, error } = await db.from("proposals").insert(row).select().single()
  if (error) {
    console.error("Save proposal failed:", error.message)
    return NextResponse.json({ error: "Could not save proposal" }, { status: 502 })
  }
  return NextResponse.json({ entry: toEntry(data) })
}

export async function DELETE(req) {
  const db = admin()
  if (!db) return NextResponse.json({ error: "Server not configured" }, { status: 500 })

  const id = new URL(req.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const { error } = await db.from("proposals").delete().eq("id", id)
  if (error) {
    console.error("Delete proposal failed:", error.message)
    return NextResponse.json({ error: "Could not delete proposal" }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}
