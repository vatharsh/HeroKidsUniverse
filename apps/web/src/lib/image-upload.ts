export interface PreparedImageUpload {
  file: File;
  preview: string;
}

type Heic2AnyFn = (options: {
  blob: Blob;
  toType?: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  return type.includes("heic") || type.includes("heif") || /\.(heic|heif)$/i.test(file.name);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image file"));
    reader.readAsDataURL(blob);
  });
}

function assertBrowserRenderableImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve();
      else reject(new Error("Image has no visible dimensions"));
    };
    image.onerror = () => reject(new Error("Browser could not render image preview"));
    image.src = src;
  });
}

async function getHeicConverter(): Promise<Heic2AnyFn> {
  const imported = await import("heic2any");
  const moduleValue = imported as unknown as {
    default?: Heic2AnyFn | { default?: Heic2AnyFn };
  };
  const defaultValue = moduleValue.default;
  const converter =
    typeof defaultValue === "function"
      ? defaultValue
      : typeof defaultValue?.default === "function"
        ? defaultValue.default
        : typeof (imported as unknown) === "function"
          ? imported as unknown as Heic2AnyFn
          : undefined;

  if (!converter) {
    throw new Error("The HEIC converter could not be loaded.");
  }

  return converter;
}

function normalizeConvertedBlob(value: Blob | Blob[]): Blob {
  const blob = Array.isArray(value) ? value[0] : value;
  if (!blob || blob.size === 0) {
    throw new Error("HEIC conversion returned an empty image.");
  }

  return blob.type === "image/jpeg"
    ? blob
    : blob.slice(0, blob.size, "image/jpeg");
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const heic2any = await getHeicConverter();
  let lastError: unknown;

  for (const toType of ["image/jpeg", "image/jpg"]) {
    try {
      const converted = await heic2any({
        blob: file,
        toType,
        quality: 0.92,
      });
      const blob = normalizeConvertedBlob(converted);

      return new File(
        [blob],
        file.name.replace(/\.(heic|heif)$/i, ".jpg") || "photo.jpg",
        { type: "image/jpeg" },
      );
    } catch (error) {
      lastError = error;
      console.warn("[image-upload] HEIC conversion attempt failed", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        toType,
        error,
      });
    }
  }

  const detail = lastError instanceof Error && lastError.message
    ? ` (${lastError.message})`
    : "";
  throw new Error(`This HEIC photo could not be converted in this browser${detail}. Please choose another photo or change iPhone Camera Format to Most Compatible.`);
}

async function buildRenderablePreview(file: File): Promise<string> {
  const dataUrl = await blobToDataUrl(file);

  try {
    await assertBrowserRenderableImage(dataUrl);
    return dataUrl;
  } catch (dataUrlError) {
    const objectUrl = URL.createObjectURL(file);
    try {
      await assertBrowserRenderableImage(objectUrl);
      return objectUrl;
    } catch (objectUrlError) {
      console.warn("[image-upload] Prepared image could not be rendered", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        dataUrlError,
        objectUrlError,
      });
      URL.revokeObjectURL(objectUrl);
      throw new Error("This photo could not be opened. Please choose another image.");
    }
  }
}

function isRawHeicPreview(preview: string): boolean {
  return preview.startsWith("data:image/heic")
    || preview.startsWith("data:image/heif")
    || preview.startsWith("data:image/heic-sequence")
    || preview.startsWith("data:image/heif-sequence");
}

export function releasePreparedImagePreview(preview: string): void {
  if (preview.startsWith("blob:")) {
    URL.revokeObjectURL(preview);
  }
}

async function verifyPreparedUpload(file: File, preview: string): Promise<void> {
  if (isHeicFile(file) || isRawHeicPreview(preview)) {
    throw new Error("This HEIC photo could not be converted. Please choose another photo or change iPhone Camera Format to Most Compatible.");
  }

  await assertBrowserRenderableImage(preview);
}

export async function prepareImageUpload(file: File): Promise<PreparedImageUpload> {
  const processedFile = isHeicFile(file) ? await convertHeicToJpeg(file) : file;
  const preview = await buildRenderablePreview(processedFile);
  await verifyPreparedUpload(processedFile, preview);

  return { file: processedFile, preview };
}
