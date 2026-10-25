"use client";

import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useState } from "react";
import ConfirmDialog from "../../_components/confirm-dialog";

/**
 * Delete control for the product editor's tab bar. Lives outside the form so
 * the owners can remove the product from whichever tab they are on; the
 * owning-store guard is decided server-side, the button only adds this dialog.
 */
export default function DeleteProductButton({ productId, name }: { productId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "The product could not be deleted.");
        return;
      }
      router.push("/panel/products");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="wbtn wbtn-danger-ghost"
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
        disabled={busy}
      >
        Delete product
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${name}?`}
        body={
          error ||
          "The product, its prices, releases, gallery links, changelog and reviews are permanently removed. Products with orders cannot be deleted. The images stay in the media library."
        }
        confirmLabel="Delete product"
        busy={busy}
        onConfirm={handleConfirm}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
