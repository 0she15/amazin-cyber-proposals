import { NextResponse } from "next/server"
import PDFDocument from "pdfkit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SECTION_HEADERS = [
  "WHO THIS IS FOR",
  "WHAT'S INCLUDED",
  "WHAT YOU'LL RECEIVE",
  "INVESTMENT",
  "NEXT STEPS",
  "A NOTE FROM OSHÉ",
]

const FOOTER = "amazincyber.com | oshe@amazincyber.com | Houston, TX"

// Build a clean, professional PDF from the proposal text using pdfkit.
function buildPdf({ name, company, proposal }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "LETTER", margins: { top: 56, bottom: 64, left: 56, right: 56 }, bufferPages: true })
      const chunks = []
      doc.on("data", (c) => chunks.push(c))
      doc.on("end", () => resolve(Buffer.concat(chunks)))
      doc.on("error", reject)

      const left = doc.page.margins.left
      const right = doc.page.width - doc.page.margins.right

      // Header
      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(26).text("Amazin Cyber")
      doc.fillColor("#3b82f6").font("Helvetica").fontSize(12).text("Microsoft 365 Security Review")
      doc.moveDown(0.7)
      doc.strokeColor("#e2e8f0").lineWidth(1).moveTo(left, doc.y).lineTo(right, doc.y).stroke()
      doc.moveDown(0.8)

      // Prepared for + date
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      doc.fillColor("#475569").font("Helvetica").fontSize(10)
      doc.text(`Prepared for: ${name || "Client"}${company ? " — " + company : ""}`)
      doc.text(`Date: ${dateStr}`)
      doc.moveDown(1)

      // Body
      const lines = String(proposal || "").replace(/\r/g, "").split("\n")
      lines.forEach((raw) => {
        const line = raw.replace(/\s+$/, "")
        const trimmed = line.trim()
        if (SECTION_HEADERS.includes(trimmed)) {
          doc.moveDown(0.6)
          doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12).text(trimmed)
          doc.moveDown(0.15)
        } else if (trimmed === "") {
          doc.moveDown(0.35)
        } else if (trimmed.startsWith("-")) {
          doc.fillColor("#1e293b").font("Helvetica").fontSize(10.5)
            .text("•  " + trimmed.replace(/^-\s*/, ""), { indent: 12, lineGap: 2 })
        } else {
          doc.fillColor("#1e293b").font("Helvetica").fontSize(10.5).text(trimmed, { lineGap: 2 })
        }
      })

      // Footer on every page
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        doc.fillColor("#94a3b8").font("Helvetica").fontSize(8)
          .text(FOOTER, left, doc.page.height - 44, { width: right - left, align: "center" })
      }
      doc.flushPages()
      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}

export async function POST(req) {
  const RESEND_KEY = process.env.RESEND_API_KEY
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 })
  }

  const name = (body.name || "").toString().trim()
  const company = (body.company || "").toString().trim()
  const email = (body.email || "").toString().trim()
  const proposal = (body.proposal || "").toString()

  if (!email) return NextResponse.json({ ok: false, error: "No recipient email address." }, { status: 400 })
  if (!proposal) return NextResponse.json({ ok: false, error: "No proposal content to send." }, { status: 400 })

  // Build the PDF first so any rendering issue surfaces before we depend on the key.
  let pdfBase64
  try {
    const pdf = await buildPdf({ name, company, proposal })
    pdfBase64 = pdf.toString("base64")
  } catch (e) {
    console.error("PDF generation failed:", e)
    return NextResponse.json({ ok: false, error: "Could not generate the PDF." }, { status: 500 })
  }

  if (!RESEND_KEY) return NextResponse.json({ ok: false, error: "Email is not configured (missing RESEND_API_KEY)." }, { status: 500 })

  const firstName = name.split(" ")[0] || name
  const text = `Hi ${firstName || "there"},

Please find your Security Snapshot proposal attached.

If you have any questions before deciding, just reply to this email — happy to talk through anything.

Looking forward to working with you.

— Oshé
Founder, Amazin Cyber
amazincyber.com | oshe@amazincyber.com`

  const safeCompany = (company || "Client").replace(/[^\w-]+/g, "-")
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Oshé Mazin <oshe@amazincyber.com>",
        to: [email],
        subject: `Your Amazin Cyber Security Snapshot proposal — ${company || ""}`.trim(),
        text,
        attachments: [{ filename: `Amazin-Cyber-Proposal-${safeCompany}.pdf`, content: pdfBase64 }],
      }),
    })
    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}))
      const msg = detail?.message || detail?.error?.message || `Resend error ${resp.status}`
      console.error("Resend send failed:", resp.status, detail)
      return NextResponse.json({ ok: false, error: msg }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("send-proposal-email error:", e)
    return NextResponse.json({ ok: false, error: e.message || "Unexpected error sending email." }, { status: 500 })
  }
}
