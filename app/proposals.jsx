"use client"
import { useState, useEffect, useRef } from "react"

const PACKAGES = [
  "Starter Snapshot — $250",
  "Business Snapshot — $500",
  "Remediation Support — $1,000+",
]
const LICENSES = [
  "Microsoft 365 Business Basic",
  "Microsoft 365 Business Standard",
  "Microsoft 365 Business Premium",
  "Microsoft 365 Apps for Business",
  "Mixed / Not sure",
]
const URGENCY = ["Standard", "Client has upcoming audit", "Recent security incident", "Time-sensitive"]
const RISK_LEVELS = ["Low", "Medium", "High"]

function formatDate(iso) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const EMPTY_FORM = {
  clientName: "", company: "", clientEmail: "", package: PACKAGES[1],
  userCount: "", licenseType: "", concerns: "", callNotes: "", urgency: URGENCY[0], riskLevel: "Medium",
}

export default function Proposals() {
  const [view, setView] = useState("generator") // generator | history
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [status, setStatus] = useState("idle") // idle | loading | done | error
  const [result, setResult] = useState(null)
  const [errorMsg, setErrorMsg] = useState("")
  const [copied, setCopied] = useState(false)
  const [history, setHistory] = useState([])
  const [selectedHistoryId, setSelectedHistoryId] = useState(null)
  const [emailing, setEmailing] = useState(false)
  const [toast, setToast] = useState(null) // { type: 'success'|'error', msg }
  const resultRef = useRef(null)

  const showToast = (type, msg) => {
    setToast({ type, msg })
    setTimeout(() => setToast(t => (t && t.msg === msg ? null : t)), 6000)
  }

  const emailProposal = async ({ name, company, email, proposal }) => {
    if (!email) { showToast("error", "Add the client's email address first."); return }
    setEmailing(true)
    try {
      const res = await fetch("/api/send-proposal-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, email, proposal }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) showToast("success", `Proposal sent to ${email}`)
      else showToast("error", data.error || "Could not send the proposal.")
    } catch (e) {
      showToast("error", e.message || "Network error sending the proposal.")
    } finally {
      setEmailing(false)
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  // Load proposal history from Supabase on mount.
  useEffect(() => {
    let active = true
    fetch("/api/save-proposal")
      .then(r => r.ok ? r.json() : { history: [] })
      .then(d => { if (active) setHistory(Array.isArray(d.history) ? d.history : []) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Pre-fill non-sensitive fields from URL params only.
  // Security: never read client name, company, concerns, or call notes from
  // the URL — those are sensitive and must not be passed through query strings.
  useEffect(() => {
    if (typeof window === "undefined") return
    const p = new URLSearchParams(window.location.search)
    const NON_SENSITIVE = ["package", "licenseType", "userCount", "urgency", "riskLevel"]
    if (!NON_SENSITIVE.some(k => p.get(k))) return
    setForm(f => ({
      ...f,
      package: p.get("package") || f.package,
      licenseType: p.get("licenseType") || f.licenseType,
      userCount: p.get("userCount") || f.userCount,
      urgency: p.get("urgency") || f.urgency,
      riskLevel: p.get("riskLevel") || f.riskLevel,
    }))
    // Clean URL
    window.history.replaceState({}, "", window.location.pathname)
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveToHistory = async (proposal, formData) => {
    try {
      const res = await fetch("/api/save-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formData.clientName,
          company: formData.company,
          package: formData.package,
          proposal,
        }),
      })
      if (res.ok) {
        const { entry } = await res.json()
        if (entry) setHistory(h => [entry, ...h].slice(0, 50))
      } else {
        console.error("Failed to save proposal to history")
      }
    } catch (e) {
      console.error("Failed to save proposal to history", e)
    }
  }

  const generate = async () => {
    if (!form.clientName || !form.company) { alert("Client name and company are required."); return }
    setStatus("loading")
    setResult(null)
    setErrorMsg("")
    setCopied(false)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || "Generation failed")
      setResult(data.proposal)
      saveToHistory(data.proposal, { ...form })
      setStatus("done")
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
    } catch (err) {
      setErrorMsg(err.message)
      setStatus("error")
    }
  }

  const handleCopy = async () => {
    const text = result || history.find(h => h.id === selectedHistoryId)?.proposal
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const activeProposal = result || (selectedHistoryId ? history.find(h => h.id === selectedHistoryId)?.proposal : null)

  return (
    <div className="min-h-screen bg-[#080d14] text-[#e8f0fe]"
      style={{ backgroundImage: "linear-gradient(rgba(59,130,246,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,.018) 1px,transparent 1px)", backgroundSize: "32px 32px" }}>

      {/* Header */}
      <div className="border-b border-[#1a2d45] px-5 py-4 sticky top-0 z-40 bg-[#080d14]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#1e3a5f] flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#3b82f6"/>
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-mono text-[#60a5fa] uppercase tracking-widest">Amazin Cyber</p>
              <p className="text-[15px] font-semibold leading-tight">Proposal Generator</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-[#1a2d45] rounded-lg p-0.5">
              {[["generator", "Generate"], ["history", `History (${history.length})`]].map(([val, label]) => (
                <button key={val} onClick={() => { setView(val); setSelectedHistoryId(null) }}
                  className={`text-[11px] font-mono px-3 py-1.5 rounded transition-colors ${view === val ? "bg-[#1e3a5f] text-[#60a5fa]" : "text-[#3d5a7a] hover:text-[#7a9abf]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={logout}
              className="text-[11px] font-mono px-3 py-1.5 rounded border border-[#1a2d45] text-[#3d5a7a] hover:text-[#7a9abf] hover:border-[#3d5a7a] transition-colors">
              Log out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-6">

        {/* ── GENERATOR VIEW ── */}
        {view === "generator" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left — Input form */}
            <div>
              <p className="text-[11px] font-mono text-[#60a5fa] uppercase tracking-wider mb-1">Client Details</p>
              <p className="text-[20px] font-semibold text-[#e8f0fe] mb-5">New Proposal</p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Contact Name *</label>
                    <input value={form.clientName} onChange={e => set("clientName", e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] placeholder-[#3d5a7a] focus:outline-none focus:border-[#3b82f6] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Company *</label>
                    <input value={form.company} onChange={e => set("company", e.target.value)}
                      placeholder="Acme Dental"
                      className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] placeholder-[#3d5a7a] focus:outline-none focus:border-[#3b82f6] transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Client Email</label>
                  <input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)}
                    placeholder="jane@acmedental.com"
                    className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] placeholder-[#3d5a7a] focus:outline-none focus:border-[#3b82f6] transition-colors" />
                  <p className="text-[10px] text-[#3d5a7a] mt-1">Used to email the proposal PDF directly to the client.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Package</label>
                  <select value={form.package} onChange={e => set("package", e.target.value)}
                    className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] focus:outline-none focus:border-[#3b82f6] transition-colors">
                    {PACKAGES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">License Type</label>
                    <select value={form.licenseType} onChange={e => set("licenseType", e.target.value)}
                      className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] focus:outline-none focus:border-[#3b82f6] transition-colors">
                      <option value="">— Select —</option>
                      {LICENSES.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">User Count</label>
                    <input value={form.userCount} onChange={e => set("userCount", e.target.value)}
                      placeholder="e.g. 12"
                      className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] placeholder-[#3d5a7a] focus:outline-none focus:border-[#3b82f6] transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Main Concerns</label>
                  <input value={form.concerns} onChange={e => set("concerns", e.target.value)}
                    placeholder="e.g. worried about phishing, had a suspicious email last month"
                    className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] placeholder-[#3d5a7a] focus:outline-none focus:border-[#3b82f6] transition-colors" />
                </div>

                <div>
                  <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Discovery Call Notes</label>
                  <textarea value={form.callNotes} onChange={e => set("callNotes", e.target.value)}
                    rows={4}
                    placeholder="What did they say on the call? What are they worried about? Any context that makes this feel specific to them..."
                    className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] placeholder-[#3d5a7a] focus:outline-none focus:border-[#3b82f6] transition-colors resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Estimated Risk Level</label>
                    <div className="flex gap-2">
                      {RISK_LEVELS.map(r => {
                        const active = form.riskLevel === r
                        const colors = {
                          Low:    active ? "bg-green-500/20 border-green-500/50 text-green-400"  : "border-[#1a2d45] text-[#3d5a7a] hover:border-green-500/30 hover:text-green-400",
                          Medium: active ? "bg-amber-500/20 border-amber-500/50 text-amber-400"  : "border-[#1a2d45] text-[#3d5a7a] hover:border-amber-500/30 hover:text-amber-400",
                          High:   active ? "bg-red-500/20 border-red-500/50 text-red-400"        : "border-[#1a2d45] text-[#3d5a7a] hover:border-red-500/30 hover:text-red-400",
                        }
                        return (
                          <button key={r} type="button" onClick={() => set("riskLevel", r)}
                            className={`flex-1 text-[12px] font-mono py-2 rounded-lg border transition-all ${colors[r]}`}>
                            {r}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#7a9abf] mb-1 uppercase tracking-wider">Urgency / Context</label>
                    <select value={form.urgency} onChange={e => set("urgency", e.target.value)}
                      className="w-full bg-[#0d1520] border border-[#1a2d45] rounded-lg px-3 py-2 text-[13px] text-[#e8f0fe] focus:outline-none focus:border-[#3b82f6] transition-colors">
                      {URGENCY.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <button id="generate-btn" onClick={generate} disabled={status === "loading"}
                  className={`w-full text-[14px] font-mono py-3 rounded-xl transition-all ${
                    status === "loading"
                      ? "bg-[#1e3a5f] text-[#3d5a7a] cursor-not-allowed"
                      : "text-white bg-[#3b82f6] hover:bg-[#2563eb]"
                  }`}>
                  {status === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-[#3d5a7a] border-t-[#60a5fa] rounded-full animate-spin"/>
                      Generating proposal…
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-2">
                      Generate Proposal
                      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </span>
                  )}
                </button>

                {status === "error" && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                    <p className="text-[12px] text-red-400">{errorMsg}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right — Output */}
            <div ref={resultRef}>
              {status === "idle" && (
                <div className="h-full flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-[#0d1520] border border-[#1a2d45] flex items-center justify-center mx-auto mb-3">
                      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
                        <rect x="9" y="3" width="6" height="4" rx="1" stroke="#3b82f6" strokeWidth="1.5"/>
                        <path d="M9 12h6M9 16h4" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="text-[13px] text-[#7a9abf]">Fill in the details and click Generate.</p>
                    <p className="text-[12px] text-[#3d5a7a] mt-1">Your proposal will appear here in about 15 seconds.</p>
                  </div>
                </div>
              )}

              {status === "loading" && (
                <div className="h-full flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#1e3a5f] border-t-[#3b82f6] rounded-full animate-spin mx-auto mb-4"/>
                    <p className="text-[13px] text-[#7a9abf]">Writing your proposal…</p>
                    <p className="text-[11px] font-mono text-[#3d5a7a] mt-1">~15 seconds</p>
                  </div>
                </div>
              )}

              {status === "done" && result && (
                <ProposalOutput proposal={result} copied={copied} onCopy={handleCopy}
                  emailing={emailing}
                  onEmail={() => emailProposal({ name: form.clientName, company: form.company, email: form.clientEmail, proposal: result })}
                  onReset={() => { setStatus("idle"); setResult(null); setForm({ ...EMPTY_FORM }) }} />
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY VIEW ── */}
        {view === "history" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-[11px] font-mono text-[#3d5a7a] uppercase tracking-wider mb-4">{history.length} saved proposal{history.length !== 1 ? "s" : ""}</p>
              {history.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-[13px] text-[#7a9abf]">No proposals generated yet.</p>
                  <button onClick={() => setView("generator")} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-mono text-[#60a5fa] hover:underline">Generate your first<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map(h => (
                    <div key={h.id} onClick={() => setSelectedHistoryId(h.id)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all ${selectedHistoryId === h.id ? "bg-[#111d2e] border-[#3b82f6]/40" : "bg-[#0d1520] border-[#1a2d45] hover:border-[#1e3a5f]"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#e8f0fe] truncate">{h.company}</p>
                          <p className="text-[11px] text-[#7a9abf]">{h.clientName} · {formatDate(h.createdAt)}</p>
                          <p className="text-[10px] font-mono text-[#3d5a7a] mt-0.5 truncate">{h.package}</p>
                        </div>
                        <button onClick={e => {
                          e.stopPropagation()
                          setHistory(hs => hs.filter(x => x.id !== h.id))
                          if (selectedHistoryId === h.id) setSelectedHistoryId(null)
                          fetch(`/api/save-proposal?id=${encodeURIComponent(h.id)}`, { method: "DELETE" })
                            .catch(() => {})
                        }} aria-label="Delete proposal" className="text-[#3d5a7a] hover:text-red-400 px-1 transition-colors flex-shrink-0">
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              {selectedHistoryId ? (
                <ProposalOutput
                  proposal={history.find(h => h.id === selectedHistoryId)?.proposal || ""}
                  copied={copied}
                  onCopy={handleCopy}
                  onReset={null}
                />
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-[13px] text-[#3d5a7a]">Select a proposal to view it.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 max-w-sm flex items-start gap-2.5 px-4 py-3 rounded-lg border text-[13px] shadow-2xl ${
            toast.type === "success"
              ? "bg-[#0d2018] border-green-500/40 text-green-300"
              : "bg-[#201013] border-red-500/40 text-red-300"
          }`}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden>
            {toast.type === "success"
              ? <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>
              : <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>}
          </svg>
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  )
}

// ── PROPOSAL OUTPUT ────────────────────────────────────────────────────────
function ProposalOutput({ proposal, copied, onCopy, onReset, onEmail, emailing }) {
  // Format proposal text into sections for display
  const sections = []
  const HEADERS = ["WHO THIS IS FOR", "WHAT'S INCLUDED", "WHAT YOU'LL RECEIVE", "INVESTMENT", "NEXT STEPS", "A NOTE FROM OSHÉ"]
  let current = null
  proposal.split("\n").forEach(line => {
    const trimmed = line.trim()
    if (HEADERS.includes(trimmed)) {
      if (current) sections.push(current)
      current = { header: trimmed, lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  })
  if (current) sections.push(current)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-mono text-[#60a5fa] uppercase tracking-wider">Generated Proposal</p>
        <div className="flex items-center gap-2">
          {onReset && (
            <button onClick={onReset}
              className="text-[11px] font-mono text-[#3d5a7a] hover:text-[#7a9abf] border border-[#1a2d45] px-3 py-1.5 rounded-lg transition-colors">
              New Proposal
            </button>
          )}
          <button onClick={onCopy}
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all ${copied ? "text-green-400 border-green-500/40 bg-green-500/10" : "text-[#7a9abf] border-[#1a2d45] hover:text-[#e8f0fe] hover:border-[#3d5a7a]"}`}>
            {copied && (
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12l4 4 10-11" /></svg>
            )}
            {copied ? "Copied" : "Copy Full Text"}
          </button>
          {onEmail && (
            <button onClick={onEmail} disabled={emailing}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-transparent text-white bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-60 transition-all">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5 12 13l8.5-6.5" /></svg>
              {emailing ? "Sending…" : "Email to Client"}
            </button>
          )}
        </div>
      </div>

      {/* Rendered sections */}
      <div className="bg-[#0d1520] border border-[#1a2d45] rounded-xl overflow-hidden">
        {sections.length > 0 ? sections.map((section, i) => (
          <div key={i} className={`px-5 py-4 ${i < sections.length - 1 ? "border-b border-[#1a2d45]" : ""}`}>
            <p className="text-[10px] font-mono text-[#60a5fa] uppercase tracking-widest mb-2">{section.header}</p>
            <div className="space-y-1">
              {section.lines.filter(l => l.trim()).map((line, j) => (
                <p key={j} className={`text-[13px] leading-relaxed ${line.trim().startsWith("-") ? "text-[#7a9abf] pl-3" : "text-[#e8f0fe]"}`}>
                  {line.trim().startsWith("-") ? line.replace(/^-\s*/, "• ") : line}
                </p>
              ))}
            </div>
          </div>
        )) : (
          <div className="p-5">
            <pre className="text-[12px] font-mono text-[#7a9abf] whitespace-pre-wrap leading-relaxed">{proposal}</pre>
          </div>
        )}
      </div>

      <div className="mt-3 bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3">
        <p className="text-[11px] text-[#7a9abf] leading-relaxed">
          <span className="text-[#60a5fa] font-semibold">Next step:</span> Copy the full text, paste into Google Docs using your proposal template, do a quick read-through, then send to the client with your Stripe payment link.
        </p>
      </div>
    </div>
  )
}
