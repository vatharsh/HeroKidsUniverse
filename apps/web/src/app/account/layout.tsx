import type { Metadata } from "next";
import type { ReactNode } from "react";

import AccountShell from "./AccountShell";

// The shell is a client component (it checks the signed-in user), so the title is set here.
export const metadata: Metadata = { title: "My Account" };

export default function Layout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
