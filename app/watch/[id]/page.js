import { notFound } from "next/navigation";
import Link from "next/link";
import { videos } from "@/data/videos";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const video = videos.find(item => item.id === id);
  return { title: video ? video.title : "Không tìm thấy phim" };
}

export default async function WatchPage({ params }) {
  const { id } = await params;
  const video = videos.find(item => item.id === id);
  if (!video) notFound();
  const recommendations = videos.filter(item => item.id !== id).slice(0, 4);
  return <main className="container py-10">
    <Link href="/" className="text-xs font-semibold text-zinc-500 hover:text-white">← Quay lại thư viện</Link>
    <div className="mt-6 grid gap-9 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section>
        <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
          {video.videoUrl ? <video className="h-full w-full" controls playsInline preload="metadata" poster={video.backdrop}><source src={video.videoUrl} /></video> : <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"><span className="text-4xl text-zinc-700">▶</span><p className="font-semibold text-zinc-300">Chưa cấu hình nguồn phát</p><p className="max-w-md text-xs leading-5 text-zinc-500">Thêm URL video hợp pháp vào trường videoUrl trong data/videos.js để bật trình phát. Không sử dụng đường dẫn mẫu không phải tệp video.</p></div>}
        </div>
        <div className="mt-6"><div className="flex flex-wrap gap-2 text-[11px] font-bold"><span className="rounded bg-red-600/15 px-2 py-1 text-red-400">{video.rating}</span><span className="rounded bg-white/5 px-2 py-1 text-zinc-400">{video.category}</span><span className="rounded bg-white/5 px-2 py-1 text-zinc-400">{video.year}</span><span className="rounded bg-white/5 px-2 py-1 text-zinc-400">{video.duration}</span></div><h1 className="mt-4 text-2xl font-black">{video.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{video.description}</p></div>
      </section>
      <aside><h2 className="mb-4 text-xs font-black uppercase tracking-[.2em] text-zinc-500">Có thể bạn thích</h2><div className="space-y-4">{recommendations.map(item => <Link href={"/watch/" + item.id} key={item.id} className="group flex gap-3"><img src={item.poster} alt="" loading="lazy" className="h-20 w-14 rounded-lg object-cover" /><div className="min-w-0 self-center"><h3 className="line-clamp-2 text-sm font-bold group-hover:text-red-400">{item.title}</h3><p className="mt-2 text-xs text-zinc-500">{item.year} · {item.category}</p></div></Link>)}</div></aside>
    </div>
  </main>;
}