"use client";
import { useState } from "react";
import { useRouter } from "@/app/panel/_components/panel-navigation";
import { useUploadThing } from "@/lib/uploadthing";
import TextField from "@/app/panel/_components/ui/text-field";
type Plan = {
  id: string;
  kind: string;
  productSlug: string;
  name: string;
  priceCents: number;
  currency: string;
  installations: number;
  creemTestProductId: string | null;
  creemLiveProductId: string | null;
  enabled: boolean;
};
type Product = { kind: "theme" | "extension"; name: string; slug: string };
export default function BillingManager({
  products,
  plans,
  releases,
  mode,
  configured,
}: {
  products: Product[];
  plans: Plan[];
  releases: {
    id: string;
    kind: string;
    productSlug: string;
    version: string;
    fileName: string;
  }[];
  mode: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [product, setProduct] = useState(
    products[0] ? `${products[0].kind}:${products[0].slug}` : "",
  );
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [installations, setInstallations] = useState("1");
  const [testId, setTestId] = useState("");
  const [liveId, setLiveId] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const { startUpload, isUploading } = useUploadThing("productPackage", {
    onUploadError: () =>
      setMessage(
        "Package upload failed. Check private-file support and product licensing.",
      ),
  });
  const [kind, slug] = product.split(":") as ["theme" | "extension", string];
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/billing-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing,
          kind,
          productSlug: slug,
          name,
          priceCents: Math.round(Number(price) * 100),
          installations: Number(installations),
          creemTestProductId: testId || null,
          creemLiveProductId: liveId || null,
          enabled,
        }),
      });
      const data = await response.json();
      setMessage(response.ok ? "Plan saved." : data.error);
      if (response.ok) {
        setEditing(undefined);
        setName("");
        router.refresh();
      }
    } catch {
      setMessage("The plan could not be saved.");
    } finally {
      setPending(false);
    }
  }
  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setMessage("");
    try {
      const result = await startUpload([file], {
        kind,
        productSlug: slug,
        version,
      });
      if (result) {
        setFile(null);
        setVersion("");
        setMessage("Private release uploaded.");
        router.refresh();
      }
    } catch {
      setMessage("The private release could not be uploaded.");
    }
  }
  return (
    <div className="wtable-card wsettings-card">
      <div className="wsettings-section">
        <p className="wsection-label">Creem / {mode}</p>
        <p>
          {configured
            ? "API key and webhook secret configured."
            : "Add CREEM_API_KEY and CREEM_WEBHOOK_SECRET in the server environment. No payments can be taken until configured."}
        </p>
        <p>
          Use recurring, every-year, tax-inclusive EUR products with no trial.
          The checkout checks these settings again. API keys stay on the server.
        </p>
        <p>
          Webhook: <code>/api/webhooks/creem</code>. Customer portal handles
          invoices, payment methods, cancellation and refund requests.
        </p>
      </div>
      <form className="wsettings-section" onSubmit={save}>
        <p className="wsection-label">
          {editing ? "Edit yearly plan" : "Add yearly plan"}
        </p>
        <label className="wfield">
          <span>Product</span>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            disabled={Boolean(editing)}
          >
            {products.map((p) => (
              <option key={`${p.kind}:${p.slug}`} value={`${p.kind}:${p.slug}`}>
                {p.name} ({p.kind})
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Service plan name"
          value={name}
          onChange={setName}
          required
        />
        <TextField
          label="Price (EUR / year, tax inclusive)"
          value={price}
          onChange={setPrice}
          required
        />
        <TextField
          label="Installations covered by support"
          value={installations}
          onChange={setInstallations}
          required
        />
        <TextField
          label="Creem test product ID"
          value={testId}
          onChange={setTestId}
        />
        <TextField
          label="Creem live product ID"
          value={liveId}
          onChange={setLiveId}
        />
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{" "}
          Enable plan after verification
        </label>
        <p>
          Includes 12 months of updates/support, automatically billed every year
          until cancellation. GPL code rights are unaffected.
        </p>
        <button className="wbtn wbtn-primary" disabled={pending || !product}>
          {pending ? "Saving…" : "Save plan"}
        </button>
        {editing && (
          <button
            type="button"
            className="wbtn wbtn-ghost"
            onClick={() => {
              setEditing(undefined);
              setName("");
              setEnabled(false);
            }}
          >
            New plan
          </button>
        )}
      </form>
      <div className="wsettings-section">
        <p className="wsection-label">Existing plans</p>
        {plans.length ? (
          plans.map((p) => (
            <p key={p.id}>
              {p.productSlug} / {p.name} — €{(p.priceCents / 100).toFixed(2)} /
              year · {p.enabled ? "enabled" : "disabled"}{" "}
              <button
                type="button"
                className="wbtn wbtn-ghost"
                onClick={() => {
                  setEditing(p.id);
                  setProduct(`${p.kind}:${p.productSlug}`);
                  setName(p.name);
                  setPrice(String(p.priceCents / 100));
                  setInstallations(String(p.installations));
                  setTestId(p.creemTestProductId ?? "");
                  setLiveId(p.creemLiveProductId ?? "");
                  setEnabled(p.enabled);
                }}
              >
                Edit
              </button>
            </p>
          ))
        ) : (
          <p>No billing plans yet.</p>
        )}
      </div>
      <form className="wsettings-section" onSubmit={upload}>
        <p className="wsection-label">Upload a private product release</p>
        <p>
          Selected product: {slug || "Select above"}. The product must have a
          verified GPL code license in its checklist. Upload only distributable
          packages with license notices. Private storage support is required in
          UploadThing.
        </p>
        <TextField
          label="Package version"
          value={version}
          onChange={setVersion}
          required
        />
        <label className="wfield">
          <span>Package file (ZIP)</span>
          <input
            type="file"
            accept=".zip,application/zip"
            required
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          className="wbtn wbtn-primary"
          disabled={isUploading || !product || !file}
        >
          {isUploading ? "Uploading…" : "Upload private package"}
        </button>
        {releases.map((r) => (
          <p key={r.id}>
            {r.productSlug} · {r.version} · {r.fileName}
          </p>
        ))}
      </form>
      <p className="wfield-hint-block" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
