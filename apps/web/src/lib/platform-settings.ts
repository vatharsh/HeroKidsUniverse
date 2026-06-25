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
