"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing";
import { useUploadSettings } from "@/app/panel/_components/upload-settings";
import { optimizeAllForUpload } from "@/lib/webp";

/**
 * Toolbar button that uploads straight into the media library. Images are
 * re-encoded as WebP per the panel settings before the transfer starts;
 * onUploadComplete records the MediaAsset rows server-side, so refreshing
 * is all the list needs to pick the new files up.
 */
export default function MediaUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const uploadSettings = useUploadSettings();
  const router = useRouter();

  const { startUpload, isUploading } = useUploadThing("mediaLibrary", {
    onClientUploadComplete: () => {
      setError("");
      router.refresh();
    },
    onUploadError: (message) => setError(message.message || "Upload failed."),
  });

  return (
    <div className="wupload-inline">
      <input
        ref={inputRef}
        id="media-library-upload"
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={async (event) => {
          const selected = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (selected.length === 0) return;
          setOptimizing(true);
          const optimized = await optimizeAllForUpload(selected, uploadSettings);
          setOptimizing(false);
          startUpload(optimized.map((entry) => entry.file));
        }}
      />
      <button
        type="button"
        className="wbtn wbtn-primary wbtn-add"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading || optimizing}
      >
        {isUploading ? "Uploading…" : optimizing ? "Optimizing…" : "Upload media"}
      </button>
      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
