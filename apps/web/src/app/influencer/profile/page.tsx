"use client";

import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface ProfileData {
  name: string;
  email: string | null;
  phone: string | null;
  platform: string | null;
  socialHandle: string | null;
  paymentMethod: string | null;
  paymentDetailsJson: Record<string, unknown> | null;
}

export default function InfluencerProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/influencer/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => setProfile((j.data ?? j) as ProfileData))
      .catch(() => null);
  }, []);

  return (
    <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
      <h2 className="font-[family-name:var(--font-display)] text-3xl text-gray-900 mb-2">Profile</h2>
      <p className="text-gray-500 mb-6">Read-only for now. We can add change requests next.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {[
          ["Name", profile?.name],
          ["Email", profile?.email],
          ["Phone", profile?.phone],
          ["Social Platform", profile?.platform],
          ["Social Handle", profile?.socialHandle],
          ["Payment Method", profile?.paymentMethod],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{value || "—"}</p>
          </div>
        ))}
      </div>
      {profile?.paymentDetailsJson && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 mt-4">
          <p className="text-sm text-gray-500">Payment Details</p>
          <pre className="text-sm text-gray-800 mt-2 whitespace-pre-wrap">{JSON.stringify(profile.paymentDetailsJson, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
