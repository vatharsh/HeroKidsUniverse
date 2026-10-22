import type { Metadata } from "next";
import type { ReactNode } from "react";

import DashboardShell from "./DashboardShell";

// The shell is a client component (it checks the signed-in user), so the title is set here.
export const metadata: Metadata = { title: "Dashboard" };

export default function Layout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
