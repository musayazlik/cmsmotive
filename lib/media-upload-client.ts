import { uploadFiles } from "./uploadthing";
import { mediaKindOf, type MediaEndpoint, type UploadedMedia } from "./media-upload-shared";
import type { UploadProvider } from "./upload-settings-shared";

async function mediaApi(body?: unknown) {
  const response = await fetch("/api/admin/media/upload", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The media upload failed.");
  return data;
}

function put(url: string, file: File, progress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url); xhr.setRequestHeader("Content-Type", file.type); xhr.timeout = 900_000;
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 95)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The file transfer failed. Check storage access and try again."));
    xhr.onerror = () => reject(new Error("Could not reach storage. Check your connection and the bucket CORS settings."));
    xhr.ontimeout = () => reject(new Error("The upload timed out. Try again."));
    xhr.onabort = () => reject(new Error("The upload was cancelled."));
    xhr.send(file);
  });
}

/** Calls the completion callback even for successful files preceding a failed transfer. */
export async function uploadMediaFiles(endpoint: MediaEndpoint, files: File[], onProgress: (value: number) => void, onUploaded: (files: UploadedMedia[]) => void) {
  const settings = await mediaApi() as { imageProvider: UploadProvider; videoProvider: UploadProvider };
  const uploaded: UploadedMedia[] = [];
  try {
    for (const [index, file] of files.entries()) {
      const progress = (value: number) => onProgress(Math.round((index * 100 + value) / files.length));
      const provider = mediaKindOf(file.type) === "video" ? settings.videoProvider : settings.imageProvider;
      if (provider === "r2") {
        const prepared = await mediaApi({ action: "prepare", endpoint, fileName: file.name, mimeType: file.type, fileSize: file.size });
        await put(prepared.url, file, progress);
        uploaded.push(await mediaApi({ action: "complete", receipt: prepared.receipt }) as UploadedMedia);
      } else {
        const result = await uploadFiles(endpoint, { files: [file], onUploadProgress: ({ progress: value }) => progress(value) });
        uploaded.push(...result.map((entry) => ({ assetId: String(entry.serverData?.assetId ?? ""), url: entry.ufsUrl, name: entry.name, mimeType: entry.type })));
      }
      progress(100);
    }
  } finally { if (uploaded.length) onUploaded(uploaded); }
}
