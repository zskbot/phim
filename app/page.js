import Link from "next/link";
import { categories, featuredVideo, videos } from "@/data/videos";

export const metadata = { title: "Trang chủ" };

function MovieCard({ video }) {
  return <Link href={"/watch/" + video.id} className="poster group overflow-hidden rounded-xl border border-white/[.07] bg-[#11131a]">
    <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
      {/* Remote poster URLs are curated in data/videos.js. */}
      <img src={video.poster} alt={video.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-white">{video.rating}</span>
      <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-[10px] text-zinc-200">{video.duration}</span>
    </div>
    <div className="p-3"><h2 className="line-clamp-2 text-sm font-bold text-zinc-100 group-hover:text-red-400">{video.title}</h2><p className="mt-2 text-xs text-zinc-500">{video.year} · {video.category}</p></div>
  </Link>;
}

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const q = (params?.q || "").toString().trim().toLocaleLowerCase("vi");
  const selected = (params?.category || "").toString();
  const filtered = videos.filter(v => (!q || (v.title + " " + v.category + " " + v.description).toLocaleLowerCase("vi").includes(q)) && (!selected || selected === "Tất cả" || v.category === selected));
  return <main>
    <section className="relative min-h-[470px] overflow-hidden border-b border-white/5">
      <img src={featuredVideo.backdrop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
      <div className="hero-gradient absolute inset-0" />
      <div className="container relative flex min-h-[470px] items-end pb-16 pt-20">
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-black uppercase tracking-[.35em] text-red-500">PHIM ĐƯỢC ĐỀ XUẤT</p>
          <h1 className="text-4xl font-black leading-tight sm:text-6xl">{featuredVideo.title}</h1>
          <p className="mt-4 text-sm text-zinc-300">{featuredVideo.year} <span className="px-2 text-zinc-600">•</span>{featuredVideo.category}<span className="px-2 text-zinc-600">•</span>{featuredVideo.duration}</p>
          <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-300">{featuredVideo.description}</p>
          <Link href={"/watch/" + featuredVideo.id} className="mt-7 inline-flex items-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-500">▶ Xem chi tiết</Link>
        </div>
      </div>
    </section>
    <section id="catalog" className="container py-12">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.25em] text-red-500">THƯ VIỆN</p><h2 className="mt-2 text-2xl font-black">Khám phá phim</h2></div><p className="text-xs text-zinc-500">{filtered.length} nội dung</p></div>
      <div className="mb-8 flex flex-wrap gap-2">{categories.map(category => <Link key={category} href={category === "Tất cả" ? "/" : "/?category=" + encodeURIComponent(category)} className={"rounded-full border px-4 py-2 text-xs font-semibold transition " + (selected === category || (!selected && category === "Tất cả") ? "border-red-600 bg-red-600 text-white" : "border-white/10 bg-white/[.03] text-zinc-400 hover:border-white/30 hover:text-white")}>{category}</Link>)}</div>
      {q && <p className="mb-5 text-sm text-zinc-400">Kết quả cho: <strong className="text-white">{params.q}</strong></p>}
      {filtered.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{filtered.map(video => <MovieCard key={video.id} video={video} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center text-sm text-zinc-500">Không tìm thấy phim phù hợp.</div>}
    </section>
  </main>;
}