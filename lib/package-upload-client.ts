/** Browser-to-R2 transfer with progress; the API only signs and verifies files. */
export async function uploadR2Package(file: File, input: { productId: string; version: string }, progress: (value: number) => void) {
  async function call(body: unknown) {
    const response = await fetch("/api/admin/releases/upload", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The package could not be uploaded.");
    return data;
  }
  const prepared = await call({ action: "prepare", ...input, fileName: file.name, fileSize: file.size });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", prepared.url);
    xhr.setRequestHeader("Content-Type", "application/zip");
    xhr.timeout = 15 * 60 * 1000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 95));
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The file transfer failed. Check the R2 bucket permissions and CORS settings."));
    xhr.onerror = () => reject(new Error("Could not reach package storage. Check your connection and the R2 bucket CORS settings."));
    xhr.ontimeout = () => reject(new Error("The upload timed out. Try uploading the package again."));
    xhr.onabort = () => reject(new Error("The upload was cancelled."));
    xhr.send(file);
  });
  await call({ action: "complete", receipt: prepared.receipt });
  progress(100);
}
