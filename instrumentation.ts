export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warmServerRuntime } = await import("@/lib/fugue/warm");
  void warmServerRuntime();
}
