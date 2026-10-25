"use client";

import { useEffect, useMemo, useState } from "react";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export type PlatformSettingType = "string" | "number" | "boolean";

export interface PlatformSetting {
  key: string;
  value: string;
  type: PlatformSettingType;
  description: string | null;
  updatedAt: string | null;
}

export type PlatformSettingsMap = Record<string, string | number | boolean>;

function parseSetting(setting: PlatformSetting): string | number | boolean {
  if (setting.type === "boolean") return setting.value === "true";
  if (setting.type === "number") return Number(setting.value);
  return setting.value;
}

export function settingsToMap(settings: PlatformSetting[]): PlatformSettingsMap {
  return Object.fromEntries(settings.map((setting) => [setting.key, parseSetting(setting)]));
}

export async function fetchPublicPlatformSettings(): Promise<PlatformSettingsMap> {
  const res = await fetch(`${BASE}/platform-settings`);
  if (!res.ok) throw new Error("Failed to load platform settings");
  const body = await res.json();
  const settings = (body.data ?? body) as PlatformSetting[];
  return settingsToMap(settings);
}

export function usePublicPlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettingsMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchPublicPlatformSettings()
      .then((data) => {
        if (active) setSettings(data);
      })
      .catch(() => {
        if (active) setError("Failed to load platform settings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const flags = useMemo(() => settings ?? {}, [settings]);
  return { settings, flags, loading, error };
}

let publicSettingsOnce: Promise<PlatformSettingsMap> | null = null;

/** Public settings fetched once per page load and shared by every component that asks. */
function usePublicSettingsShared(): PlatformSettingsMap | null {
  const [map, setMap] = useState<PlatformSettingsMap | null>(null);
  useEffect(() => {
    let active = true;
    publicSettingsOnce ??= fetchPublicPlatformSettings().catch(() => ({}));
    void publicSettingsOnce.then((m) => {
      if (active) setMap(m);
    });
    return () => {
      active = false;
    };
  }, []);
  return map;
}

/** Pages in the free preview story (FREE_PREVIEW_PAGES), for marketing copy. */
export function usePreviewPages(): number {
  const n = Number(usePublicSettingsShared()?.FREE_PREVIEW_PAGES);
  return n > 0 ? n : 3;
}

export interface MaintenanceInfo {
  message: string;
  backBy: string;
  /** Message plus "We'll be back by …" when a time is set. */
  full: string;
}

/** Non-null while maintenance mode is on (MAINTENANCE_MODE). */
export function useMaintenance(): MaintenanceInfo | null {
  const map = usePublicSettingsShared();
  if (!map || map.MAINTENANCE_MODE !== true) return null;
  const message = String(map.MAINTENANCE_MESSAGE ?? "").trim() || "We're making a few improvements and will be back shortly.";
  const backBy = String(map.MAINTENANCE_BACK_BY ?? "").trim();
  return { message, backBy, full: backBy ? `${message} We'll be back by ${backBy}.` : message };
}
