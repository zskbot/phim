"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export default function HomeFeed() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [source, setSource] = useState("demo");
  useEffect(() => {
    const syncQuery = () => setQuery(new URLSearchParams(window.location.search).get("q") || "");
    const handleSearch = event => setQuery(typeof event.detail === "string" ? event.detail : "");
    syncQuery();
    window.addEventListener("phim-search", handleSearch);
    window.addEventListener("popstate", syncQuery);
    return () => {
      window.removeEventListener("phim-search", handleSearch);
      window.removeEventListener("popstate", syncQuery);
    };
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/videos", { headers: { Accept: "application/json" } });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Không tải được video feed");
        if (active) { setVideos(data.results || []); setSource(data.source || "provider"); setError(""); }
      } catch (err) { if (active) setError(err.message || "Không thể tải dữ liệu video."); }
      finally { if (active) setLoading(false); }
    }
    load();
    const timer = window.setInterval(load, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  const categories = useMemo(() => ["Tất cả", ...new Set(videos.map(v => v.category).filter(Boolean))], [videos]);
  const filtered = useMemo(() => videos.filter(v => {
    const haystack = (v.title + " " + v.description + " " + v.category).toLocaleLowerCase("vi");
    return (category === "Tất cả" || v.category === category) && haystack.includes(query.trim().toLocaleLowerCase("vi"));
  }), [videos, category, query]);
  const featured = videos[0];
  return <main>
    {featured && <section className="relative min-h-[390px] overflow-hidden border-b border-white/5">
      {featured.backdrop && <img src={featured.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />}
      <div className="hero-gradient absolute inset-0" />
      <div className="container relative flex min-h-[390px] items-end pb-14 pt-20"><div className="max-w-xl">
        <p className="mb-4 text-xs font-black uppercase tracking-[.3em] text-red-500">ĐƯỢC CẬP NHẬT TỪ VIDEO FEED</p>
        <h1 className="text-4xl font-black leading-tight sm:text-6xl">{featured.title}</h1>
        <p className="mt-4 text-sm text-zinc-300">{featured.year} · {featured.category} · {featured.duration}</p>
        <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-300">{featured.description}</p>
        <Link href={"/watch/" + encodeURIComponent(featured.id)} className="mt-6 inline-flex rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-500">▶ Xem chi tiết</Link>
      </div></div>
    </section>}
    <section id="catalog" className="container py-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-red-500">DYNAMIC DATA FEED</p><h2 className="mt-2 text-2xl font-black">Danh sách video</h2></div><span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">● {source === "telegram+demo" ? "Telegram + Demo" : source === "provider+telegram" ? "Provider + Telegram" : source === "provider" ? "Provider API" : "Demo feed"}</span></div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row"><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên phim, mô tả..." aria-label="Tìm video" className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[.04] px-4 text-sm outline-none focus:border-red-600" /><select value={category} onChange={e => setCategory(e.target.value)} aria-label="Lọc thể loại" className="h-11 rounded-xl border border-white/10 bg-[#11131a] px-4 text-sm text-zinc-200 outline-none focus:border-red-600">{categories.map(item => <option key={item}>{item}</option>)}</select></div>
      {loading ? <div className="py-24 text-center text-sm text-zinc-500">Đang đồng bộ danh sách video...</div> : error ? <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">{error}</div> : filtered.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{filtered.map(video => <Link key={video.id} href={"/watch/" + encodeURIComponent(video.id)} className="poster group overflow-hidden rounded-xl border border-white/[.07] bg-[#11131a]">
        <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">{video.poster ? <img src={video.poster} alt={video.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-xs text-zinc-600">No poster</div>}<span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold">{video.rating}</span>{video.provider === "telegram-public" && <span className="absolute bottom-2 left-2 rounded bg-sky-600/90 px-2 py-1 text-[10px] font-bold text-white">TELEGRAM</span>}<span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-[10px]">{video.duration}</span></div>
        <div className="p-3"><h3 className="line-clamp-2 text-sm font-bold text-zinc-100 group-hover:text-red-400">{video.title}</h3><p className="mt-2 text-xs text-zinc-500">{video.year} · {video.category}</p><p className="mt-1 text-[11px] text-zinc-600">{Number(video.views || 0).toLocaleString("vi-VN")} lượt xem</p></div>
      </Link>)}</div> : <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center text-sm text-zinc-500">Không tìm thấy video phù hợp.</div>}
    </section>
  </main>;
}