"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUploadThing } from "@/lib/uploadthing";
import { removeAvatarAction } from "../_actions";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

export type AvatarEditorLabels = {
  change: string;
  uploading: string;
  remove: string;
  removing: string;
  hint: string;
  fallbackError: string;
  notAnImage: string;
  tooLarge: string;
};

export default function AvatarEditor({
  image,
  name,
  labels,
}: {
  image: string | null;
  name: string;
  labels: AvatarEditorLabels;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [removing, startRemoval] = useTransition();
  const { startUpload, isUploading } = useUploadThing("avatar", {
    // The upload request itself writes user.image (app/api/uploadthing core).
    onClientUploadComplete: () => {
      setMessage("");
      router.refresh();
    },
    onUploadError: () => setMessage(labels.fallbackError),
  });

  const initial = name.trim()[0]?.toUpperCase() || "?";
  const busy = isUploading || removing;

  function choose(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage(labels.notAnImage);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage(labels.tooLarge);
      return;
    }
    setMessage("");
    void startUpload([file]);
  }

  function remove() {
    setMessage("");
    startRemoval(async () => {
      await removeAvatarAction();
      router.refresh();
    });
  }

  return (
    <div className="customer-avatar-editor">
      <span className="customer-profile-avatar customer-profile-avatar-lg" data-photo={Boolean(image)}>
        {image ? <img src={image} alt="" width={96} height={96} referrerPolicy="no-referrer" /> : initial}
      </span>
      <div className="customer-avatar-editor-tools">
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <div className="customer-avatar-editor-buttons">
          <button
            type="button"
            className="wbtn wbtn-sm"
            onClick={() => input.current?.click()}
            disabled={busy}
          >
            {isUploading ? labels.uploading : labels.change}
          </button>
          {image ? (
            <button
              type="button"
              className="wbtn wbtn-sm wbtn-ghost"
              onClick={remove}
              disabled={busy}
            >
              {removing ? labels.removing : labels.remove}
            </button>
          ) : null}
        </div>
        <p className="customer-avatar-editor-hint">{labels.hint}</p>
        {message ? (
          <p className="wdialog-error" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
