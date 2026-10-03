import axios from "axios";
import { request, object, str } from "../api/client";
export async function uploadResource(
  file: File,
  progress: (value: string) => void,
  signal: AbortSignal,
) {
  progress("Preparing file upload…");
  const data = object(
    (
      await request(
        "tutor/resources/uploads",
        "POST",
        { filename: file.name, size_bytes: file.size },
        signal,
      )
    ).data,
  );
  if (data.method !== "PUT" || !str(data.upload_url) || !str(data.upload_token))
    throw new Error("Unexpected upload authorization response.");
  progress("Uploading file…");
  await axios.put(str(data.upload_url), file, {
    headers: object(data.headers) as Record<string, string>,
    signal,
    timeout: 180000,
    onUploadProgress: (e) =>
      progress(
        `Uploading file… ${e.total ? Math.round((e.loaded / e.total) * 100) : 0}%`,
      ),
  });
  progress("File transferred. Saving resource…");
  return str(data.upload_token);
}
export async function uploadMedia(
  file: File,
  purpose: string,
  progress: (v: string) => void,
  signal: AbortSignal,
) {
  progress("Preparing media upload…");
  const data = object(
    (
      await request(
        "upload/presign",
        "POST",
        { purpose, file_type: file.type, file_size: file.size },
        signal,
      )
    ).data,
  );
  if (!str(data.cloud_name) || !str(data.signature) || !str(data.api_key))
    throw new Error("Unexpected media authorization response.");
  if (
    file.size > Number(data.max_size_bytes) ||
    !Array.isArray(data.allowed_types) ||
    !data.allowed_types.includes(file.type)
  )
    throw new Error(
      "This file format or size is not supported for this purpose.",
    );
  const form = new FormData();
  form.append("file", file);
  for (const key of ["signature", "timestamp", "api_key", "upload_preset"])
    if (data[key]) form.append(key, str(data[key]));
  progress("Uploading media…");
  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(str(data.cloud_name))}/${encodeURIComponent(str(data.resource_type))}/upload`,
    form,
    {
      signal,
      timeout: 180000,
      onUploadProgress: (e) =>
        progress(
          `Uploading media… ${e.total ? Math.round((e.loaded / e.total) * 100) : 0}%`,
        ),
    },
  );
  progress("Registering media…");
  await request(
    "upload/store-metadata",
    "POST",
    { purpose, cloudinary_data: response.data },
    signal,
  );
  progress("Media registered");
  return {
    url: str(object(response.data).secure_url),
    public_id: str(object(response.data).public_id),
  };
}
