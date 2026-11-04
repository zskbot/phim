"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WatchPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [video, setVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [detailResponse, listResponse] = await Promise.all([fetch("/api/videos?id=" + encodeURIComponent(id)), fetch("/api/videos")]);
        const detail = await detailResponse.json();
        const list = await listResponse.json();
        if (!detailResponse.ok || !detail.success) throw new Error("Không tìm thấy video yêu cầu.");
        if (active) { setVideo(detail.result); setRecommendations((list.results || []).filter(item => item.id !== id).slice(0, 5)); }
      } catch (err) { if (active) setError(err.message || "Không thể tải chi tiết video."); }
      finally { if (active) setLoading(false); }
    }
    if (id) load();
    return () => { active = false; };
  }, [id]);
  if (loading) return <main className="container py-24 text-center text-sm text-zinc-500">Đang tải dữ liệu video...</main>;
  if (error || !video) return <main className="container py-24 text-center"><p className="text-sm text-zinc-400">{error || "Không tìm thấy video."}</p><Link href="/" className="mt-5 inline-block text-sm text-red-400">← Về trang chủ</Link></main>;
  return <main className="container py-10">
    <Link href="/" className="text-xs font-semibold text-zinc-500 hover:text-white">← Quay lại thư viện</Link>
    <div className="mt-6 grid gap-9 lg:grid-cols-[minmax(0,1fr)_300px]"><section>
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        {video.videoUrl ? <video className="h-full w-full" controls playsInline preload="metadata" poster={video.backdrop || video.poster}><source src={video.videoUrl} /></video> : video.embedUrl ? <iframe title={video.title} src={video.embedUrl} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /> : <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"><span className="text-4xl text-zinc-700">▶</span><p className="font-semibold text-zinc-300">Chưa có nguồn phát được cấp quyền</p><p className="max-w-md text-xs leading-5 text-zinc-500">Cấu hình videoUrl hoặc embedUrl từ nhà cung cấp. Iframe chỉ hoạt động với hostname được khai báo trong VIDEO_EMBED_ALLOWED_HOSTS.</p></div>}
      </div>
      <div className="mt-6"><div className="flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded bg-red-600/15 px-2 py-1 text-red-400">{video.rating}</span><span className="rounded bg-white/5 px-2 py-1 text-zinc-400">{video.category}</span><span className="rounded bg-white/5 px-2 py-1 text-zinc-400">{video.year}</span><span className="rounded bg-white/5 px-2 py-1 text-zinc-400">{video.duration}</span>{video.provider === "telegram-public" && <span className="rounded bg-sky-500/10 px-2 py-1 text-sky-300">Telegram công khai</span>}</div><h1 className="mt-4 text-2xl font-black">{video.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{video.description}</p>{video.sourceUrl && <a href={video.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex text-xs font-semibold text-sky-300 hover:text-sky-200">Mở bài đăng gốc trên Telegram ↗</a>}<p className="mt-3 text-xs text-zinc-600">ID: {video.id} · {Number(video.views || 0).toLocaleString("vi-VN")} lượt xem</p></div>
    </section><aside><h2 className="mb-4 text-xs font-black uppercase tracking-[.2em] text-zinc-500">Có thể bạn thích</h2><div className="space-y-4">{recommendations.map(item => <Link href={"/watch/" + encodeURIComponent(item.id)} key={item.id} className="group flex gap-3"><div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-900">{item.poster && <img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}</div><div className="min-w-0 self-center"><h3 className="line-clamp-2 text-sm font-bold group-hover:text-red-400">{item.title}</h3><p className="mt-2 text-xs text-zinc-500">{item.year} · {item.category}</p></div></Link>)}</div></aside></div>
  </main>;
}
