import { PHASE_PRODUCTION_BUILD } from "next/constants";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
    const { warmDbPool } = await import("@/lib/db/pool");
    // A database outage must not block Web startup. The normal request path
    // retains its error handling while connection warm-up is best effort.
    void warmDbPool();
  }
}
