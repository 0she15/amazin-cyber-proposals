import Anthropic from "@anthropic-ai/sdk"

export async function POST(req) {
  try {
    const body = await req.json()
    const { clientName, company, package: pkg, userCount, licenseType, concerns, callNotes, urgency } = body

    const PACKAGE_DETAILS = {
      "Starter Snapshot — $250": {
        price: "$250",
        includes: [
          "MFA coverage check — which accounts have multi-factor authentication enabled",
          "Admin role overview — review of accounts holding admin or privileged roles",
          "Email authentication check — SPF, DKIM, and DMARC record review",
          "Basic mailbox rule review — check for suspicious forwarding or inbox filters",
          "Written summary report — plain-English findings with prioritized recommendations",
        ],
        deliverable: "Written summary report delivered within 3–5 business days",
        deposit: "$125",
      },
      "Business Snapshot — $500": {
        price: "$500",
        includes: [
          "Everything in Starter Snapshot",
          "Sign-in risk and Conditional Access review — risky sign-ins, legacy auth, CA policies",
          "Microsoft Defender and security baseline review — Secure Score, top recommendations",
          "Suspicious inbox rule and external forwarding review",
          "Detailed findings report with context and prioritized recommendations",
          "30-minute debrief call to walk through findings and answer questions",
        ],
        deliverable: "Detailed findings report + debrief call, delivered within 3–5 business days",
        deposit: "$250",
      },
      "Remediation Support — $1,000+": {
        price: "Starting at $1,000",
        includes: [
          "Everything in Business Snapshot",
          "Hands-on remediation of approved findings",
          "Configuration assistance directly in your Microsoft 365 environment",
          "Documentation of all changes made",
          "Final validation check confirming findings are resolved",
        ],
        deliverable: "Business Snapshot report + remediation work, scoped and approved before any changes are made",
        deposit: "$500",
      },
    }

    const pkgDetails = PACKAGE_DETAILS[pkg] || PACKAGE_DETAILS["Business Snapshot — $500"]

    const systemPrompt = `You are writing a professional service proposal for Amazin Cyber, a cybersecurity consulting business run by Oshé that provides Microsoft 365 security reviews for small businesses.

TONE: Professional but human. Plain English. No jargon. No buzzwords. No scare tactics. Calm and confident.
LENGTH: 1.5 to 2 pages when printed. Concise. Every sentence earns its place.
VOICE: First-person singular (I, not we). Oshé is a solo operator — be honest about that. It's a strength.

FORMAT: Return the proposal as clean plain text with these exact section headers on their own lines:
WHO THIS IS FOR
WHAT'S INCLUDED
WHAT YOU'LL RECEIVE
INVESTMENT
NEXT STEPS
A NOTE FROM OSHÉ

Do not use markdown. Do not use bullet symbols — use plain hyphens (-) for lists. Do not add any intro or outro text outside the proposal itself.`

    const userPrompt = `Generate a complete proposal for the following engagement:

CLIENT: ${clientName}
COMPANY: ${company}
PACKAGE: ${pkg} (${pkgDetails.price})
USERS: ${userCount || "Not specified"}
LICENSE TYPE: ${licenseType || "Not specified"}
MAIN CONCERNS: ${concerns || "General security posture review"}
CALL NOTES: ${callNotes || "Standard discovery call — client wants to understand their current security posture"}
URGENCY: ${urgency || "Standard"}

PACKAGE DETAILS TO USE:
Price: ${pkgDetails.price}
Deposit required: ${pkgDetails.deposit} (50% upfront)
What's included:
${pkgDetails.includes.map(i => `- ${i}`).join("\n")}
Deliverable: ${pkgDetails.deliverable}

INSTRUCTIONS:
- WHO THIS IS FOR: 2-3 sentences specific to ${company}'s situation based on the call notes and concerns. Make it feel like you listened.
- WHAT'S INCLUDED: List the package items as clean hyphens. Add one sentence of plain-English context after each item.
- WHAT YOU'LL RECEIVE: Describe the deliverable and what happens after. Mention the debrief call if applicable.
- INVESTMENT: State the price clearly. Mention 50% deposit to begin, remainder on delivery. Note that all work is scoped and approved before it starts.
- NEXT STEPS: Three numbered steps. Simple. 1) Sign and send deposit. 2) Fill out intake form. 3) I'll be in touch within 1 business day to confirm start date.
- A NOTE FROM OSHÉ: 3-4 sentences. Personal. Reinforce the no-jargon, practical approach. Mention Houston if relevant. End with something that sounds like a real person wrote it — not a template.`

    const client = new Anthropic()
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    })

    const text = message.content.find(b => b.type === "text")?.text || ""
    return Response.json({ proposal: text })

  } catch (err) {
    console.error("Proposal generation error:", err)
    return Response.json({ error: err.message || "Generation failed" }, { status: 500 })
  }
}
