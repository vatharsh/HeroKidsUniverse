"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InfluencerIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/influencer/dashboard");
  }, [router]);
  return null;
}
