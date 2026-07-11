import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "WhatsAppInboxBot/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();

    const get = (prop: string) => {
      const m =
        html.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i")) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"));
      return m?.[1] ?? null;
    };

    const title =
      get("title") ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      null;

    return NextResponse.json({
      title,
      description: get("description"),
      image: get("image"),
      url,
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
