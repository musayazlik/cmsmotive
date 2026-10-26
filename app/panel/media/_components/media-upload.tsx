"use client";

import { useRef } from "react";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useOptimizedUpload } from "@/app/panel/_components/use-optimized-upload";

export default function MediaUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { upload, busy, status, error } = useOptimizedUpload("mediaLibrary", ["image", "video"], () => router.refresh());
  return (
    <div className="wupload-inline">
      <input ref={inputRef} id="media-library-upload" type="file" accept="image/*,video/*" multiple hidden
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) await upload(files);
        }} />
      <button type="button" className="wbtn wbtn-primary wbtn-add" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? status : "Upload media"}
      </button>
      {error ? <p className="wdialog-error" role="alert">{error}</p> : null}
    </div>
  );
}
