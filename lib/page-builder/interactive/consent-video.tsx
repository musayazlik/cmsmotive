"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ConsentVideoProps = {
  provider: "youtube" | "vimeo";
  videoId: string;
  title: string;
  poster?: string;
  aspectRatio?: "16/9" | "4/3" | "1/1";
};

const CONSENT_STORAGE_KEY = "cmsmotive_video_consent";
/** Fired after consent is stored so every open player mounts at once. */
const CONSENT_EVENT = "cmsmotive:video-consent";

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getConsentSnapshot(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getConsentServerSnapshot(): boolean {
  return false;
}

/**
 * Two-click video consent (plan 5.12): the iframe — and with it the provider's
 * cookies — loads only after the visitor explicitly opts in. The choice is
 * remembered per browser; the embed renders server-side as the poster card.
 */
export function ConsentVideo({
  provider,
  videoId,
  title,
  poster,
  aspectRatio = "16/9",
}: ConsentVideoProps) {
  const consented = useSyncExternalStore(subscribe, getConsentSnapshot, getConsentServerSnapshot);

  const handleConsent = useCallback(() => {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, "true");
    } catch {
      // Storage may be unavailable (private mode); consent for this view only.
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }, []);

  const embedUrl =
    provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`
      : `https://player.vimeo.com/video/${encodeURIComponent(videoId)}?autoplay=1`;

  const ratioClass = aspectRatio === "4/3" ? "pb-video--4-3" : aspectRatio === "1/1" ? "pb-video--1-1" : "pb-video--16-9";

  if (consented) {
    return (
      <div className={`pb-video ${ratioClass}`}>
        <iframe
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="pb-video-iframe"
        />
      </div>
    );
  }

  const providerName = provider === "youtube" ? "YouTube" : "Vimeo";

  return (
    <div className={`pb-video pb-video--consent ${ratioClass}`}>
      {poster ? (
        <img src={poster} alt="" className="pb-video-poster" loading="lazy" />
      ) : (
        <div className="pb-video-fallback-poster" />
      )}
      <div className="pb-video-consent-card">
        <p className="pb-video-consent-text">
          {providerName} videosunu izlemek için üçüncü taraf çerezlerini kabul etmeniz gerekir.
        </p>
        <button type="button" onClick={handleConsent} className="pb-video-play-btn" aria-label={`Play ${title}`}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>Videoyu Oynat ({providerName})</span>
        </button>
      </div>
    </div>
  );
}
