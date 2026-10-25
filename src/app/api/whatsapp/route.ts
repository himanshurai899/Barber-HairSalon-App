import { getDb } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { handlePost, handleVerify } from "@/lib/whatsapp-webhook";

export async function GET(req: Request) {
  const r = handleVerify(new URL(req.url), process.env.WA_VERIFY_TOKEN ?? "");
  return new Response(r.body, { status: r.status });
}

export async function POST(req: Request) {
  const r = await handlePost(req, await getDb(), { appSecret: process.env.WA_APP_SECRET ?? "", siteUrl: siteUrl() });
  return new Response(r.body, { status: r.status });
}
