import { loadHtml } from "@/lib/preview-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPIRED_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Preview unavailable</title>
<style>
  html,body{height:100%;margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
  body{display:flex;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;padding:24px;}
  .card{max-width:420px;text-align:center;background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 20px 40px -20px rgba(15,23,42,.2);}
  h1{font-size:20px;margin:0 0 8px;}
  p{margin:0;color:#475569;line-height:1.6;font-size:14px;}
</style>
</head>
<body>
  <div class="card">
    <h1>This preview link is no longer available</h1>
    <p>Preview links expire after 7 days. Ask whoever shared the link to generate a new one.</p>
  </div>
</body>
</html>`;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  let result;
  try {
    result = await loadHtml(params.id);
  } catch {
    result = null;
  }

  if (!result) {
    return new Response(EXPIRED_PAGE, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(result.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
