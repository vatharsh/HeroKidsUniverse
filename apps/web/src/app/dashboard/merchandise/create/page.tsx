import { Suspense } from "react";

import MerchandiseCreateClientPage from "./MerchandiseCreateClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-space-gradient flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        </div>
      }
    >
      <MerchandiseCreateClientPage />
    </Suspense>
  );
}
