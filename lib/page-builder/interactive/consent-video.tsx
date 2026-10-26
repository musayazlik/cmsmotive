"use client";

import { useState, useEffect } from "react";

export type ConsentVideoProps = {
  provider: "youtube" | "vimeo";
  videoId: string;
  title: string;
  poster?: string;
  aspectRatio?: "16/9" | "4/3" | "1/1";
};

const CONSENT_STORAGE_KEY = "cmsmotive_video_consent";

export function ConsentVideo({
  provider,
  videoId,
  title,
  poster,
  aspectRatio = "16/9",
}: ConsentVideoProps) {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CONSENT_STORAGE_KEY) === "true") {
        setConsented(true);
      }
    } catch {
      // localStorage might be unavailable
    }
  }, []);

  function handleConsent() {
    setConsented(true);
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, "true");
    } catch {
      // ignore
    }
  }

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
        <button
          type="button"
          onClick={handleConsent}
          className="pb-video-play-btn"
          aria-label={`Play ${title}`}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>Videoyu Oynat ({providerName})</span>
        </button>
      </div>
    </div>
  );
}
