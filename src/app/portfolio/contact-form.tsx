"use client";

import { useState } from "react";
import { services, COMPANY } from "./projects";

type Status = "idle" | "sending" | "sent" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Something went wrong sending your message.");
      }
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "sent") {
    return (
      <div className="contact-sent" role="status">
        <div className="contact-sent-mark" aria-hidden="true">
          ✓
        </div>
        <h3>Message sent</h3>
        <p>
          Thanks — we&apos;ve got it and will get back to you within a couple of days. In the
          meantime you can also reach us at{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </p>
        <button type="button" className="btn-ghost" onClick={() => setStatus("idle")}>
          Send another
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
      <div className="field-row">
        <label className="field">
          <span>Name</span>
          <input name="name" type="text" required autoComplete="name" placeholder="Your name" />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>
            Company <em>(optional)</em>
          </span>
          <input name="company" type="text" autoComplete="organization" placeholder="Company" />
        </label>
        <label className="field">
          <span>What do you need?</span>
          <select name="projectType" defaultValue="">
            <option value="" disabled>
              Pick one…
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.title}>
                {s.title}
              </option>
            ))}
            <option value="Not sure yet">Not sure yet</option>
          </select>
        </label>
      </div>

      <label className="field">
        <span>
          Budget <em>(optional)</em>
        </span>
        <select name="budget" defaultValue="">
          <option value="">Prefer not to say</option>
          <option value="< $5k">Under $5k</option>
          <option value="$5k–$15k">$5k–$15k</option>
          <option value="$15k–$50k">$15k–$50k</option>
          <option value="$50k+">$50k+</option>
        </select>
      </label>

      <label className="field">
        <span>Project details</span>
        <textarea
          name="message"
          required
          rows={5}
          placeholder="What are you building, and roughly when do you need it?"
        />
      </label>

      {/* Honeypot: bots fill this, humans never see it. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hp-field"
        aria-hidden="true"
      />

      {status === "error" && (
        <p className="form-error" role="alert">
          {error} You can also email us at{" "}
          <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send project brief"}
      </button>
    </form>
  );
}
