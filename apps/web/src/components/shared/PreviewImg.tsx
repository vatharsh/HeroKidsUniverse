"use client";

import type React from "react";
import { useState } from "react";

import { previewMediaUrl, resolveMediaUrl } from "@/lib/media-url";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | null | undefined };

/**
 * Story picture for lists and cards: loads the ~35 KB preview instead of the ~1.2 MB original,
 * lazily, and falls back to the original if the preview doesn't exist.
 */
export default function PreviewImg({ src, onError, alt = "", ...rest }: Props) {
  const preview = previewMediaUrl(src);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const usePreview = !!preview && failedFor !== src;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading="lazy"
      decoding="async"
      alt={alt}
      {...rest}
      src={usePreview ? preview : resolveMediaUrl(src)}
      onError={(e) => {
        if (usePreview) { setFailedFor(src ?? null); return; }
        onError?.(e);
      }}
    />
  );
}
