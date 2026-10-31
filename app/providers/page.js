"use client";

import { useEffect, useState } from "react";

const PROVIDERS = [
  { id: "youtube", label: "YouTube" },
  { id: "vimeo", label: "Vimeo" },
  { id: "dailymotion", label: "Dailymotion · profile tags" }
];

export default function ProviderSandboxPage() {
  const [provider, setProvider] = useState("youtube");
  const [query, setQuery] = useState("nature documentary");
  const [providers, setProviders] = useState([]);
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/providers", { cache: "no-store" })
      .then(response => response.json())
      .then(data => setProviders(data.providers || []))
      .catch(() => setProviders([]));
  }, []);

  async function search(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResults([]);
    setSelected(null);
    try {
      const params = new URLSearchParams({ provider, q: query });
      const response = await fetch("/api/providers/search?" + params.toString());
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Provider request failed");
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || "Không thể tìm kiếm video.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container min-h-screen py-12">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-red-500">SANDBOX / STAGING</p>
        <h1 className="mt-2 text-3xl font-black">Legal Video Provider Lab</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Thử nghiệm metadata và player nhúng chính thức. Không tải hoặc lưu trữ video nguồn.</p>
      </div>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        {PROVIDERS.map(item => {
          const status = providers.find(providerItem => providerItem.id === item.id);
          return <div key={item.id} className="rounded-xl border border-white/10 bg-white/[.03] p-4">
            <p className="font-bold">{item.label}</p>
            <p className="mt-2 text-xs text-zinc-500">{status?.status || "checking"}</p>
          </div>;
        })}
      </section>

      <form onSubmit={search} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-4 sm:flex-row">
        <select value={provider} onChange={event => setProvider(event.target.value)} className="h-11 rounded-lg border border-white/10 bg-[#11131a] px-3 text-sm">
          {PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <input value={query} onChange={event => setQuery(event.target.value)} maxLength={120} required aria-label="Search query" className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-4 text-sm" placeholder={provider === "dailymotion" ? "Nhập tag của video trong profile đã cấp quyền..." : "Search videos..."} />
        <button disabled={loading} className="h-11 rounded-lg bg-red-600 px-6 text-sm font-bold disabled:opacity-50">{loading ? "Đang tìm..." : "Tìm video"}</button>
      </form>

      {provider === "dailymotion" && <p className="mt-3 text-xs leading-5 text-zinc-500">Dailymotion API v2 hiện truy vấn video công khai thuộc profile đã cấu hình theo tag; không phải tìm kiếm toàn bộ Dailymotion. Cần access token và profile ID có quyền truy cập.</p>}
      {error && <p role="alert" className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">{error}</p>}

      {selected && <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">{selected.title}</h2>
        <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          {selected.embedUrl ? <iframe title={selected.title} src={selected.embedUrl} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" /> : <div className="grid h-full place-items-center p-6 text-center text-sm text-zinc-400">Provider không trả về embed URL hợp lệ hoặc video không cho phép nhúng.</div>}
        </div>
        <p className="mt-2 text-xs text-zinc-500">Nguồn: {selected.provider} · ID: {selected.providerId}</p>
      </section>}

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold">Kết quả tìm kiếm <span className="text-zinc-500">({results.length})</span></h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map(item => <button type="button" key={item.id} onClick={() => setSelected(item)} className="overflow-hidden rounded-xl border border-white/10 bg-white/[.03] text-left transition hover:border-red-500/50">
            {item.poster ? <img src={item.poster} alt="" loading="lazy" className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-zinc-900" />}
            <div className="p-4"><p className="line-clamp-2 text-sm font-bold">{item.title}</p><p className="mt-2 line-clamp-2 text-xs text-zinc-500">{item.description}</p><span className="mt-3 inline-block text-xs font-semibold text-red-400">Chọn để xem player →</span></div>
          </button>)}
        </div>
      </section>
      <p className="mt-12 border-t border-white/10 pt-5 text-xs leading-6 text-zinc-600">Chỉ nhúng nội dung được chủ sở hữu cho phép và tuân thủ điều khoản nhà cung cấp. API không tự động cấp quyền phân phối lại hoặc cấp phép thương mại.</p>
    </main>
  );
}
