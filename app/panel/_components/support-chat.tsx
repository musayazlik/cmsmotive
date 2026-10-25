"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { SUPPORT_HISTORY_LIMIT, SUPPORT_MESSAGE_LIMIT } from "@/lib/support-chat-shared";
import { CHAT_COPY } from "./support-chat-copy";
import { usePathname } from "./panel-navigation";

/**
 * Floating support chat for the panel.
 *
 * A launcher sits in the bottom-right corner of every panel page. A few seconds
 * after the page loads, a cloud-shaped "need help?" bubble pops up above it
 * with a soft chime (once per browser session). Clicking either the launcher
 * or the cloud opens a compact chat sheet. Replies come from the authenticated
 * OpenRouter endpoint, using recent turns and the panel's system language.
 */

type ChatMessage = { id: number; from: "user" | "assistant"; text: string };

const CLOUD_DELAY_MS = 6_500; // a few seconds of browsing before it offers help
const CLOUD_LINGER_MS = 12_000; // how long the cloud stays when ignored
const SESSION_SEEN_KEY = "cm-support-cloud-seen";

/**
 * WebAudio needs a user gesture before it may play. A first pointer/keydown
 * anywhere unlocks the context; until then audible feedback simply stays off.
 */
function useChimeOnce() {
  const audioRef = useRef<AudioContext | null>(null);
  const playedRef = useRef(false);

  useEffect(() => {
    const unlock = () => {
      if (typeof window === "undefined") return;
      if (!audioRef.current) {
        const Ctx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        audioRef.current = new Ctx();
      }
      if (audioRef.current.state === "suspended") void audioRef.current.resume().catch(() => undefined);
    };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      void audioRef.current?.close().catch(() => undefined);
    };
  }, []);

  /** Two soft sine notes climbing — a friendly bell for the cloud's arrival. */
  return useCallback(() => {
    if (playedRef.current) return;
    playedRef.current = true;
    const context = audioRef.current;
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    if (context.state !== "running") return;

    const now = context.currentTime + 0.02;
    const note = (frequency: number, at: number, duration: number, peak: number, type: OscillatorType) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.linearRampToValueAtTime(peak, now + at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + at);
      oscillator.stop(now + at + duration + 0.05);
    };
    note(659.25, 0, 0.5, 0.09, "sine"); // E5
    note(987.77, 0.14, 0.7, 0.07, "sine"); // B5
    note(1318.51, 0.14, 0.45, 0.03, "triangle"); // shimmer
  }, []);
}

export default function SupportChat({ firstName, language }: { firstName: string; language: Locale }) {
  const copy = CHAT_COPY[language];
  const pathname = usePathname();
  const chime = useChimeOnce();
  const [cloud, setCloud] = useState<"waiting" | "shown" | "leaving" | "done">("waiting");
  const [sheet, setSheet] = useState<"closed" | "open" | "closing">("closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const nextId = useRef(0);
  const timersRef = useRef<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef(false); // marks "don't nag again" for this session
  const focusReturnRef = useRef<HTMLButtonElement | null>(null);

  const markSeen = useCallback(() => {
    if (seenRef.current) return;
    seenRef.current = true;
    try {
      sessionStorage.setItem(SESSION_SEEN_KEY, "1");
    } catch {
      /* private mode: the cloud simply behaves like every fresh page */
    }
  }, []);

  // The cloud waits a few seconds, rings, lingers, then fades away on its own.
  useEffect(() => {
    if (cloud !== "waiting") return;
    const showTimer = window.setTimeout(() => {
      try {
        if (sessionStorage.getItem(SESSION_SEEN_KEY)) {
          setCloud("done");
          return;
        }
      } catch {
        /* sessionStorage unavailable: show the cloud on every load */
      }
      setCloud("shown");
      chime();
    }, CLOUD_DELAY_MS);
    timersRef.current.push(showTimer);
    return () => window.clearTimeout(showTimer);
  }, [cloud, chime]);

  useEffect(() => {
    if (cloud !== "shown") return;
    const leaveTimer = window.setTimeout(() => setCloud("leaving"), CLOUD_LINGER_MS);
    timersRef.current.push(leaveTimer);
    return () => window.clearTimeout(leaveTimer);
  }, [cloud]);

  useEffect(() => {
    if (cloud !== "leaving") return;
    const goneTimer = window.setTimeout(() => {
      markSeen();
      setCloud("done");
    }, 240);
    timersRef.current.push(goneTimer);
    return () => window.clearTimeout(goneTimer);
  }, [cloud, markSeen]);

  const clearAllTimers = useCallback(() => {
    for (const timer of timersRef.current.splice(0)) window.clearTimeout(timer);
  }, []);

  // Opening the sheet: remember focus, seed the greeting, put the caret in the field.
  const openSheet = useCallback(() => {
    clearAllTimers();
    if (cloud === "waiting" || cloud === "shown") {
      markSeen();
      setCloud("done");
    }
    focusReturnRef.current = document.activeElement as HTMLButtonElement | null;
    setMessages((current) => {
      if (current.length > 0) return current;
      return [
        {
          id: 0,
          from: "assistant",
          text: copy.greeting(firstName),
        },
      ];
    });
    setSheet("open");
  }, [clearAllTimers, cloud, copy, firstName, markSeen]);

  const closeSheet = useCallback(() => {
    setSheet((current) => (current === "open" ? "closing" : current));
    const fade = window.setTimeout(() => {
      setSheet("closed");
      focusReturnRef.current?.focus();
    }, 190);
    timersRef.current.push(fade);
  }, []);

  // Escape closes the sheet, and focus lands inside it on open for keyboards.
  useEffect(() => {
    if (sheet !== "open") return;
    inputRef.current?.focus({ preventScroll: true });
  }, [sheet]);

  useEffect(() => {
    if (sheet !== "open" && sheet !== "closing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && sheet === "open") closeSheet();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheet, closeSheet]);

  useEffect(() => () => clearAllTimers(), [clearAllTimers]);
  useEffect(() => () => requestRef.current?.abort(), []);

  // Keep the newest message in view while the conversation grows.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, pending, error]);

  const send = useCallback(async (text: string, retry = false) => {
    const trimmed = text.trim();
    if (!trimmed || requestRef.current || (!retry && error)) return;
    const conversation: ChatMessage[] = retry
      ? messages
      : [...messages, { id: ++nextId.current, from: "user", text: trimmed }];
    if (!retry) {
      setMessages(conversation);
      setDraft("");
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          pathname,
          messages: conversation.filter((message) => message.id !== 0).slice(-SUPPORT_HISTORY_LIMIT)
            .map((message) => ({ role: message.from, content: message.text })),
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(response.status === 401 || response.status === 403 ? "unauthorized" : result.error === "not_configured" ? "not_configured" : "unavailable");
        return;
      }
      if (typeof result.content !== "string" || !result.content.trim()) throw new Error("Empty reply");
      nextId.current += 1;
      const reply: ChatMessage = { id: nextId.current, from: "assistant", text: result.content };
      setMessages((current) => [...current, reply]);
    } catch {
      if (!controller.signal.aborted) setError("unavailable");
    } finally {
      requestRef.current = null;
      setPending(false);
    }
  }, [language, pathname, messages, error]);

  return (
    <div className="wchat-dock">
      {cloud === "shown" || cloud === "leaving" ? (
        /* The "need help?" bubble, drawn from white blobs so it reads as a cloud. */
        <div className={`wchat-cloud-wrap${cloud === "leaving" ? " is-leaving" : ""}`}>
          <div className="wchat-cloud-bob">
            <div className="wchat-cloud">
              <span className="wchat-cloud-bump wchat-cloud-bump-left" aria-hidden="true" />
              <span className="wchat-cloud-bump wchat-cloud-bump-mid" aria-hidden="true" />
              <span className="wchat-cloud-bump wchat-cloud-bump-right" aria-hidden="true" />
              <button
                type="button"
                className="wchat-cloud-close"
                aria-label={copy.dismissCloud}
                onClick={(event) => {
                  event.stopPropagation();
                  setCloud("leaving");
                }}
              >
                ×
              </button>
              <button type="button" className="wchat-cloud-open" aria-label={copy.openChat} onClick={openSheet}>
                <strong>{copy.cloudTitle}</strong>
                <small>{copy.cloudText}</small>
              </button>
              <span className="wchat-cloud-tail" aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : null}

      <section
        id="panel-support-chat"
        className={`wchat-sheet${sheet === "closing" ? " is-closing" : ""}`}
        role="dialog"
        aria-label={copy.dialog}
        style={sheet === "closed" ? { display: "none" } : undefined}
      >
        <header className="wchat-head">
          <div className="wchat-head-identity">
            <span className="wchat-avatar" aria-hidden="true">
              ✦
            </span>
            <div>
              <strong>{copy.name}</strong>
              <span className="wchat-status">
                <i className="wchat-status-dot" aria-hidden="true" /> {copy.status}
              </span>
            </div>
          </div>
          <button type="button" className="wchat-close" aria-label={copy.closeChat} onClick={closeSheet}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="wchat-scroll" ref={scrollRef} role="log" aria-label={copy.dialog} aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`wchat-msg wchat-msg-${message.from}`}>
              <p>{message.text}</p>
            </div>
          ))}
          {pending ? (
            <div className="wchat-msg wchat-msg-assistant" role="status">
              <span className="wchat-sr-only">{copy.typing}</span>
              <p className="wchat-typing">
                <i />
                <i />
                <i />
              </p>
            </div>
          ) : null}
        </div>

        <div className="wchat-foot">
          {error ? (
            <div className="wchat-error" role="alert">
              <p>{copy.errors[error] ?? copy.errors.unavailable}</p>
              <button type="button" onClick={() => void send(messages.at(-1)?.text ?? "", true)} disabled={pending}>{copy.retry}</button>
            </div>
          ) : null}
          {messages.every((message) => message.from === "assistant") && messages.length < 3 ? (
            <div className="wchat-chips" aria-label={copy.suggestions}>
              {copy.quickPrompts.map((prompt) => (
                <button key={prompt} type="button" disabled={pending || Boolean(error)} onClick={() => void send(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="wchat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              maxLength={SUPPORT_MESSAGE_LIMIT}
              readOnly={Boolean(error)}
              placeholder={copy.placeholder}
              aria-label={copy.messageLabel}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              type="submit"
              className="wchat-send"
              aria-label={copy.send}
              disabled={draft.trim().length === 0 || pending || Boolean(error)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </button>
          </form>
          <small className="wchat-disclaimer">{copy.disclaimer}</small>
        </div>
      </section>

      <button
        type="button"
        className={`wchat-launch${sheet === "open" || sheet === "closing" ? " is-open" : ""}`}
        aria-label={sheet === "open" ? copy.launchClose : copy.launchOpen}
        aria-expanded={sheet === "open"}
        aria-controls="panel-support-chat"
        onClick={() => (sheet === "open" || sheet === "closing" ? closeSheet() : openSheet())}
      >
        <svg className="wchat-launch-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6a8.5 8.5 0 1 1 16-3.9Z" />
          <path d="M8.5 11h7" />
        </svg>
        <svg className="wchat-launch-x" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
