import type { Metadata } from "next";
import type { ReactNode } from "react";

import InfluencerShell from "./InfluencerShell";

// The shell is a client component (it checks the signed-in user), so the title is set here.
export const metadata: Metadata = { title: "Influencer Portal" };

export default function Layout({ children }: { children: ReactNode }) {
  return <InfluencerShell>{children}</InfluencerShell>;
}
