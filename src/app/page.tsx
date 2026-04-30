"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

type Mockup = { name: string; html: string };

export default function Home() {
  const [urls, setUrls] = useState<[string, string, string]>(["", "", ""]);
  const [currentSite, setCurrentSite] = useState("");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>("");
  const [brandColor, setBrandColor] = useState("");
  const [clientName, setClientName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mockups, setMockups] = useState<Mockup[]>([]);

  useEffect(() => {
    if (!isLoading) {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLoading]);

  function handleUrlChange(index: 0 | 1 | 2, value: string) {
    setUrls((prev) => {
      const next = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  }

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoDataUrl(null);
      setLogoFileName("");
      return;
    }
    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") setLogoDataUrl(result);
    };
    reader.onerror = () => setError("Could not read the selected logo file");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!logoDataUrl) {
      setError("Please upload a logo image");
      return;
    }

    setIsLoading(true);
    setMockups([]);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls,
          currentSite,
          logoDataUrl,
          brandColor,
          clientName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Generation failed");
      }
      setMockups(data.mockups as Mockup[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsLoading(false);
    }
  }

  function downloadMockup(mockup: Mockup) {
    const safeClient = clientName.trim().replace(/[^a-z0-9-_]+/gi, "-") || "client";
    const safeName = mockup.name.replace(/[^a-z0-9-_]+/gi, "-");
    const blob = new Blob([mockup.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeClient}-${safeName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_32%),linear-gradient(135deg,_#f8fafc_0%,_#eef2ff_48%,_#f8fafc_100%)] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-8 max-w-3xl">
          <div className="mb-4 inline-flex items-center rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
            AI-powered homepage concepts
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Mockup Generator
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
            Generate three distinct homepage mockups from inspiration sites, brand
            direction, and a logo, then review each concept at a more realistic width.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-xl shadow-slate-200/70 backdrop-blur sm:p-8"
        >
          <div className="mb-6 flex flex-col gap-2 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Project Inputs
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add the core brand details and the sites Claude should use for direction.
              </p>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium text-white">
              3 concepts per run
            </span>
          </div>

          <div className="space-y-6">
            <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Client&rsquo;s current website (optional)
            </label>
            <input
              type="url"
              placeholder="https://acmecoffee.com — leave blank if they don't have one"
              value={currentSite}
              onChange={(e) => setCurrentSite(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
            />
            <p className="mt-1 text-xs text-slate-500">
              If provided, Claude will fetch this site first to use the client&rsquo;s real
              copy, voice, and palette as canonical brand truth.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <label className="mb-2 block text-sm font-semibold text-slate-800">
                  Inspiration URL {i + 1}
                  {i > 0 && (
                    <span className="text-slate-400 font-normal"> (optional)</span>
                  )}
                </label>
                <input
                  type="url"
                  required={i === 0}
                  placeholder="https://example.com"
                  value={urls[i]}
                  onChange={(e) => handleUrlChange(i as 0 | 1 | 2, e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
                />
              </div>
            ))}
          </div>
          <p className="-mt-3 text-xs text-slate-500">
            At least one inspiration URL required; up to three.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Logo
              </label>
              <input
                type="file"
                accept="image/*"
                required
                onChange={handleLogoChange}
                className="block w-full cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition file:mr-3 file:rounded-xl file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:border-slate-400 hover:file:bg-slate-800"
              />
              {logoFileName && (
                <p className="mt-1 text-xs text-slate-500 truncate">{logoFileName}</p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Brand color (optional)
              </label>
              <input
                type="text"
                placeholder="#FF6600"
                pattern="^#?[0-9A-Fa-f]{6}$"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                Client name
              </label>
              <input
                type="text"
                required
                placeholder="Acme Coffee Roasters"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
            >
              {isLoading
                ? `Generating… ${elapsedSec}s elapsed`
                : "Generate Mockups"}
            </button>
            {isLoading && (
              <span className="text-sm leading-6 text-slate-500">
                Claude is fetching your inspiration sites and designing 3 layouts
                (typically 60–120s; see the dev terminal for live progress).
              </span>
            )}
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          </div>
        </form>

        {mockups.length === 3 && (
          <section className="mt-12">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                  Results
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review each generated homepage at a wider, easier-to-scan preview size.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {mockups.map((m, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-xl shadow-slate-200/80 backdrop-blur"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-white/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Concept {i + 1}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-950">
                        {m.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadMockup(m)}
                      className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-950"
                    >
                      Download HTML
                    </button>
                  </div>
                  <iframe
                    title={m.name}
                    srcDoc={m.html}
                    sandbox="allow-scripts"
                    className="h-[760px] w-full bg-white lg:h-[900px]"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
