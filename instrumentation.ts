import { warmFugueApiConnection } from "@/lib/fugue/warm";

export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  void warmFugueApiConnection();
}
