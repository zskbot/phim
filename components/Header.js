"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  function submit(event) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? "/?q=" + encodeURIComponent(value) : "/");
    window.dispatchEvent(new CustomEvent("phim-search", { detail: value }));
  }
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#08090d]/90 backdrop-blur-xl">
      <div className="container flex h-[70px] items-center gap-6">
        <Link href="/" className="shrink-0 text-2xl font-black tracking-[-.08em] text-red-600">PHIM<span className="text-white">.</span></Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-zinc-400 md:flex">
          <Link className="hover:text-white" href="/">Trang chủ</Link>
          <a className="hover:text-white" href="/#catalog">Khám phá</a>
          <a className="hover:text-white" href="/#catalog">Thể loại</a>
        </nav>
        <form onSubmit={submit} className="ml-auto flex w-full max-w-sm items-center rounded-full border border-white/10 bg-white/[.04] px-4 focus-within:border-red-600/70">
          <span className="mr-2 text-zinc-500" aria-hidden="true">⌕</span>
          <input aria-label="Tìm kiếm phim" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm phim, thể loại..." className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-600" />
          <button className="text-xs font-semibold text-zinc-400 hover:text-white" type="submit">Tìm</button>
        </form>
      </div>
    </header>
  );
}