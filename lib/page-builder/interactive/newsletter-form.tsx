"use client";

import { useState } from "react";

export function NewsletterForm({
  buttonText = "Subscribe",
  privacyVersion = "1.0",
  privacyNote,
}: {
  buttonText?: string;
  privacyVersion?: string;
  privacyNote?: string;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) {
      setErrorMsg("Please accept the privacy policy.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          consent: true,
          consentVersion: privacyVersion,
          source: "footer",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok || res.status === 202) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Subscription failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Please try again later.");
    }
  }

  if (status === "success") {
    return (
      <div style={{ padding: "20px", background: "var(--success-soft, #edf7dc)", borderRadius: "var(--radius, 14px)", color: "var(--success, #365a11)" }}>
        <strong>Thank you!</strong> Please check your email to confirm your subscription.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, maxWidth: 540, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input
          type="text"
          required
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--line, #cbd2d3)",
            background: "var(--surface, #fff)",
            fontSize: "0.9rem",
          }}
        />
        <input
          type="text"
          required
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--line, #cbd2d3)",
            background: "var(--surface, #fff)",
            fontSize: "0.9rem",
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          type="email"
          required
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid var(--line, #cbd2d3)",
            background: "var(--surface, #fff)",
            fontSize: "0.9rem",
          }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="pb-button pb-button--primary pb-button--md"
          style={{
            padding: "10px 22px",
            borderRadius: 8,
            background: "var(--indigo, #4353e8)",
            color: "#fff",
            fontWeight: 600,
            border: "none",
            cursor: status === "loading" ? "wait" : "pointer",
          }}
        >
          {status === "loading" ? "Sending..." : buttonText}
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.8rem", color: "var(--muted, #5e666d)", cursor: "pointer", textAlign: "left" }}>
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>
          {privacyNote || "I agree to receive newsletters and product updates. Unsubscribe anytime."}
        </span>
      </label>

      {errorMsg && (
        <span style={{ fontSize: "0.82rem", color: "var(--warn, #b3372a)", textAlign: "left" }}>
          {errorMsg}
        </span>
      )}
    </form>
  );
}
