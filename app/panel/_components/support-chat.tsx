"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Floating support chat for the panel.
 *
 * A launcher sits in the bottom-right corner of every panel page. A few seconds
 * after the page loads, a cloud-shaped "need help?" bubble pops up above it
 * with a soft chime (once per browser session). Clicking either the launcher
 * or the cloud opens an animated chat sheet with a small local assistant.
 *
 * The assistant answers from a canned keyword map below; wiring a real model
 * later only means calling an endpoint inside `assistantReply` and pushing its
 * text instead.
 */

type ChatMessage = { id: number; from: "user" | "assistant"; text: string };

const CLOUD_DELAY_MS = 6_500; // a few seconds of browsing before it offers help
const CLOUD_LINGER_MS = 12_000; // how long the cloud stays when ignored
const SESSION_SEEN_KEY = "cm-support-cloud-seen";

const TYPING_MIN_MS = 900;
const TYPING_EXTRA_MS = 500;

const QUICK_PROMPTS = ["Publishing a post", "What can the AI do?", "Switching themes"] as const;

/** Keyword-matched canned answers; the first match wins. */
const CANNED_REPLIES: { keys: string[]; reply: string }[] = [
  {
    keys: ["post", "blog", "publish", "write", "article"],
    reply:
      "Posts live under Blog → Posts. Start a new post and the editor autosaves as a draft — you can also open Generate with AI to have the title, body, tags and cover image drafted for you before publishing.",
  },
  {
    keys: ["ai", "assistant", "model", "generate"],
    reply:
      "The AI tools are under Blog → Generate with AI and Settings → AI. Pick your text and image models there, then drafts, covers, tags and even web research are one click away. Generated content is always saved as a draft first.",
  },
  {
    keys: ["theme", "template", "design", "layout"],
    reply:
      "Themes manages everything: install a new theme, browse its detail page and switch the active one. Customization happens on the theme page itself — no code needed.",
  },
  {
    keys: ["media", "image", "upload", "file", "photo"],
    reply:
      "The Media library keeps every upload in one place. Drag files straight onto the page or add them from any editor — surfaces are optimized automatically and reusable across posts and products.",
  },
  {
    keys: ["review", "rating", "approve"],
    reply:
      "Customer reviews land in the Reviews screen. Approve or reject them one by one; the sidebar badge counts the ones still waiting for you.",
  },
  {
    keys: ["user", "account", "password", "profile", "role"],
    reply:
      "Workspace members are managed under Users. Your own profile, email and password live under My account at the bottom of the sidebar.",
  },
  {
    keys: ["inbox", "message", "contact", "telegram"],
    reply:
      "Contact messages arrive in the Inbox — unread ones are badges in the sidebar. Telegram is linked from Settings if you also want notifications and chats forwarded to the bot.",
  },
];

const FALLBACK_REPLY =
  "I can help with posts, themes, media, users, reviews and the AI features. Which one would you like to explore? Anything beyond that, I'll point you to the contact form.";

/** Small keyword-based reply; replace the body with an API call to go live. */
function assistantReply(text: string) {
  const lower = text.toLowerCase();
  for (const entry of CANNED_REPLIES) {
    if (entry.keys.some((key) => lower.includes(key))) return entry.reply;
  }
  return FALLBACK_REPLY;
}

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

export default function SupportChat({ firstName }: { firstName: string }) {
  const chime = useChimeOnce();
  const [cloud, setCloud] = useState<"waiting" | "shown" | "leaving" | "done">("waiting");
  const [sheet, setSheet] = useState<"closed" | "open" | "closing">("closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingReplies, setPendingReplies] = useState(0);
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
    try {
      if (sessionStorage.getItem(SESSION_SEEN_KEY)) {
        setCloud("done");
        return;
      }
    } catch {
      /* sessionStorage unavailable: show the cloud on every load */
    }
    const showTimer = window.setTimeout(() => {
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
      nextId.current += 1;
      return [
        {
          id: nextId.current,
          from: "assistant",
          text: `Hi ${firstName}! 👋 I'm the CMSMotive assistant. Ask me about posts, themes, media, the AI tools — or anything else around the panel.`,
        },
      ];
    });
    setSheet("open");
  }, [clearAllTimers, cloud, firstName, markSeen]);

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

  // Keep the newest message in view while the conversation grows.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, pendingReplies]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    nextId.current += 1;
    setMessages((current) => [...current, { id: nextId.current, from: "user", text: trimmed }]);
    setDraft("");
    setPendingReplies((count) => count + 1);
    // Simulated typing; a real backend would resolve a fetch into the same push.
    const delay = TYPING_MIN_MS + Math.random() * TYPING_EXTRA_MS;
    const timer = window.setTimeout(() => {
      // The reply id is only claimed when the reply appears, so rapid messages
      // can never collide.
      nextId.current += 1;
      setPendingReplies((count) => count - 1);
      setMessages((current) => [...current, { id: nextId.current, from: "assistant", text: assistantReply(trimmed) }]);
    }, delay);
    timersRef.current.push(timer);
  }, []);

  return (
    <div className="wchat-dock">
      {cloud === "shown" || cloud === "leaving" ? (
        /* The "need help?" bubble, drawn from white blobs so it reads as a cloud. */
        <div className={`wchat-cloud-wrap${cloud === "leaving" ? " is-leaving" : ""}`}>
          <div className="wchat-cloud-bob">
            <div
              className="wchat-cloud"
              role="button"
              tabIndex={0}
              aria-label="Open the support chat"
              onClick={openSheet}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openSheet();
                }
              }}
            >
              <span className="wchat-cloud-bump wchat-cloud-bump-left" aria-hidden="true" />
              <span className="wchat-cloud-bump wchat-cloud-bump-mid" aria-hidden="true" />
              <span className="wchat-cloud-bump wchat-cloud-bump-right" aria-hidden="true" />
              <button
                type="button"
                className="wchat-cloud-close"
                aria-label="Dismiss the help bubble"
                onClick={(event) => {
                  event.stopPropagation();
                  setCloud("leaving");
                }}
              >
                ×
              </button>
              <strong>Need a hand?</strong>
              <small>I can show you around the panel.</small>
              <span className="wchat-cloud-tail" aria-hidden="true" />
            </div>
          </div>
        </div>
      ) : null}

      <section
        className={`wchat-sheet${sheet === "closing" ? " is-closing" : ""}`}
        role="dialog"
        aria-label="Support chat"
        style={sheet === "closed" ? { display: "none" } : undefined}
      >
        <header className="wchat-head">
          <div className="wchat-head-top">
            <span className="wchat-head-eyebrow" aria-hidden="true">
              SUPPORT / ASSISTANT
            </span>
            <button type="button" className="wchat-close" aria-label="Close the chat" onClick={closeSheet}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="wchat-head-identity">
            <span className="wchat-avatar" aria-hidden="true">
              ✦
            </span>
            <div>
              <strong>CMSMotive Assistant</strong>
              <span className="wchat-status">
                <i className="wchat-status-dot" aria-hidden="true" /> Online — replies instantly
              </span>
            </div>
          </div>
        </header>

        <div className="wchat-scroll" ref={scrollRef} aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={`wchat-msg wchat-msg-${message.from}`}>
              <p>{message.text}</p>
            </div>
          ))}
          {pendingReplies > 0 ? (
            <div className="wchat-msg wchat-msg-assistant" aria-label="The assistant is typing">
              <p className="wchat-typing">
                <i />
                <i />
                <i />
              </p>
            </div>
          ) : null}
        </div>

        <div className="wchat-foot">
          {messages.every((message) => message.from === "assistant") && messages.length < 3 ? (
            <div className="wchat-chips" aria-label="Suggested questions">
              {QUICK_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" onClick={() => send(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
          <form
            className="wchat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              maxLength={500}
              placeholder="Type a message…"
              aria-label="Message for the assistant"
              onChange={(event) => setDraft(event.target.value)}
            />
            <button
              type="submit"
              className="wchat-send"
              aria-label="Send the message"
              disabled={draft.trim().length === 0 || pendingReplies > 3}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
            </button>
          </form>
        </div>
      </section>

      <button
        type="button"
        className={`wchat-launch${sheet === "open" || sheet === "closing" ? " is-open" : ""}`}
        aria-label={sheet === "open" ? "Close the support chat" : "Open the support chat"}
        aria-expanded={sheet === "open"}
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
