"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Small native-dialog confirmation used before destructive actions. */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Delete",
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="wdialog"
      onClose={onClose}
      onClick={(event) => {
        // Click on the backdrop closes the dialog.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="wdialog-head">
        <div>
          <span className="wdialog-eyebrow">Please confirm</span>
          <h2>{title}</h2>
        </div>
        <button type="button" className="wdialog-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="wdialog-body">
        <p className="wdialog-text">{body}</p>
      </div>
      <div className="wdialog-foot">
        <button type="button" className="wbtn wbtn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="wbtn wbtn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
