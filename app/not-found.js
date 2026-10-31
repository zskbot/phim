import Link from "next/link";
export default function NotFound() {
  return <main className="container grid min-h-[60vh] place-items-center text-center"><div><p className="text-6xl font-black text-red-600">404</p><h1 className="mt-4 text-2xl font-bold">Không tìm thấy nội dung</h1><p className="mt-2 text-sm text-zinc-500">Phim có thể đã bị gỡ hoặc đường dẫn không hợp lệ.</p><Link href="/" className="mt-6 inline-block rounded-lg bg-red-600 px-5 py-3 text-sm font-bold">Về trang chủ</Link></div></main>;
}