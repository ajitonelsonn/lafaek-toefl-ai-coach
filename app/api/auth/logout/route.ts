import { json, route } from "@/lib/server/http";
import { destroyCurrentSession } from "@/lib/server/auth/session";

export const POST = route(async () => {
  await destroyCurrentSession();
  return json({ status: "signed_out" });
});
