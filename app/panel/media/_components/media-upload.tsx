"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing";

/**
 * Toolbar button that uploads straight into the media library. The
 * onUploadComplete hook already records the MediaAsset row server-side,
 * so refreshing is all the list needs to pick the new files up.
 */
export default function MediaUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
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
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) startUpload(files);
        }}
      />
      <button
        type="button"
        className="wbtn wbtn-primary wbtn-add"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? "Uploading…" : "Upload media"}
      </button>
      {error ? (
        <p className="wdialog-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
