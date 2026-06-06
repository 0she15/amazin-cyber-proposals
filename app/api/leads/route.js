import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Server-only: list leads from Supabase via the service role key (bypasses RLS).
// Gated by the operator-auth middleware. Used by the proposal form's CRM picker.

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: "Server not configured" }, { status: 500 })

  const db = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await db
    .from("leads")
    .select("id, name, company, email, phone, package, status, notes, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("List leads failed:", error.message)
    return NextResponse.json({ error: "Could not load leads" }, { status: 502 })
  }

  const leads = (data || []).map((r) => ({
    id: r.id,
    name: r.name || "",
    company: r.company || "",
    email: r.email || "",
    phone: r.phone || "",
    package: r.package || "",
    status: r.status || "new",
    notes: r.notes || "",
  }))
  return NextResponse.json({ leads })
}
