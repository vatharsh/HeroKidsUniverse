import type { Metadata } from "next";
import type { ReactNode } from "react";

import AdminShell from "./AdminShell";

// The shell is a client component (it checks the signed-in user), so the title is set here.
export const metadata: Metadata = { title: "Admin" };

export default function Layout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
