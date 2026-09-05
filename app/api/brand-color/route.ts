import { NextRequest } from "next/server";

const pastel = (hex: string) => {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null;
  const rgb = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  return `rgb(${rgb.map((v) => Math.round(v * .18 + 255 * .82)).join(" ")})`;
};

export async function POST(req: NextRequest) {
  const { ticker } = await req.json().catch(() => ({ ticker: "" }));
  if (!ticker) return Response.json({ error: "ticker required" }, { status: 400 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Response.json({ color: "#F2F2F2", source: "fallback" });
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `For company stock ticker ${ticker}, identify its official representative brand color. Reply with ONLY one six-digit hex color.` }] }] }) });
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.match(/#[0-9a-f]{6}/i)?.[0];
    return Response.json({ color: pastel(raw ?? "#D9E2F3"), source: "gemini" });
  } catch { return Response.json({ color: "#F2F2F2", source: "fallback" }); }
}
