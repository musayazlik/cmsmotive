"use client";

import { useState } from "react";

export function ContactForm({
  submitText = "Send Message",
}: {
  submitText?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agency, setAgency] = useState("");
  const [typo3Version, setTypo3Version] = useState("TYPO3 13 LTS");
  const [license, setLicense] = useState("Agency");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          agency,
          typo3Version,
          license,
          message,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Submission failed. Please check form fields.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again later.");
    }
  }

  if (status === "success") {
    return (
      <div style={{ padding: "32px", background: "var(--success-soft, #edf7dc)", borderRadius: "var(--radius, 14px)", color: "var(--success, #365a11)", textAlign: "center" }}>
        <h3 style={{ fontSize: "1.4rem", marginBottom: 8 }}>Message Received!</h3>
        <p style={{ margin: 0 }}>Thank you for reaching out. We will get back to your inquiry shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16, textAlign: "left" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-muted, #55616a)", marginBottom: 4 }}>
            Full Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--line, #cbd2d3)",
              background: "var(--surface, #fff)",
              fontSize: "0.9rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-muted, #55616a)", marginBottom: 4 }}>
            Work Email *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--line, #cbd2d3)",
              background: "var(--surface, #fff)",
              fontSize: "0.9rem",
            }}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-muted, #55616a)", marginBottom: 4 }}>
            Agency / Organization *
          </label>
          <input
            type="text"
            required
            value={agency}
            onChange={(e) => setAgency(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--line, #cbd2d3)",
              background: "var(--surface, #fff)",
              fontSize: "0.9rem",
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-muted, #55616a)", marginBottom: 4 }}>
            TYPO3 Version
          </label>
          <select
            value={typo3Version}
            onChange={(e) => setTypo3Version(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--line, #cbd2d3)",
              background: "var(--surface, #fff)",
              fontSize: "0.88rem",
            }}
          >
            <option value="TYPO3 13 LTS">TYPO3 13 LTS</option>
            <option value="TYPO3 14 LTS">TYPO3 14 LTS</option>
            <option value="Not on TYPO3 yet">Not on TYPO3 yet</option>
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-muted, #55616a)", marginBottom: 4 }}>
            License Plan
          </label>
          <select
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid var(--line, #cbd2d3)",
              background: "var(--surface, #fff)",
              fontSize: "0.88rem",
            }}
          >
            <option value="Single site">Single site</option>
            <option value="Agency">Agency</option>
            <option value="Enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "var(--ink-muted, #55616a)", marginBottom: 4 }}>
          Project Scope / Message *
        </label>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us about your project requirements, schedule and technical expectations..."
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--line, #cbd2d3)",
            background: "var(--surface, #fff)",
            fontSize: "0.9rem",
            resize: "vertical",
          }}
        />
      </div>

      {errorMsg && (
        <div style={{ color: "var(--warn, #b3372a)", fontSize: "0.85rem" }}>
          {errorMsg}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={status === "loading"}
          className="pb-button pb-button--primary pb-button--md"
          style={{
            padding: "12px 28px",
            borderRadius: 8,
            background: "var(--indigo, #4353e8)",
            color: "#fff",
            fontWeight: 700,
            border: "none",
            cursor: status === "loading" ? "wait" : "pointer",
          }}
        >
          {status === "loading" ? "Submitting..." : submitText}
        </button>
      </div>
    </form>
  );
}
