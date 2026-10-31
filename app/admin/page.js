"use client";

import { useState } from "react";

const initialForm = { title: "", description: "", category: "Giải trí", poster_url: "", embed_url: "", rights_holder: "", license_reference: "", license_expires_at: "" };
const labels = { pending_review: "Chờ duyệt", approved: "Đã duyệt", published: "Đang phát hành", rejected: "Từ chối", archived: "Lưu trữ", draft: "Bản nháp" };

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function api(path = "/api/admin/videos", options = {}) {
    const response = await fetch(path, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }, cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload;
  }
  async function loadCatalog() {
    setBusy(true); setMessage("");
    try { const data = await api(); setItems(data.results || []); setAuthenticated(true); }
    catch (error) { setAuthenticated(false); setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await api("/api/admin/videos", { method: "POST", body: JSON.stringify(form) });
      setForm(initialForm); setMessage("Đã gửi nội dung vào hàng chờ duyệt."); await loadCatalog();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function transition(id, status) {
    setBusy(true); setMessage("");
    try { await api(`/api/admin/videos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) }); await loadCatalog(); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  return <main className="container min-h-[70vh] py-10">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.25em] text-red-400">TX.TOP / STAGING</p><h1 className="mt-2 text-3xl font-black">Admin CMS</h1><p className="mt-2 text-sm text-zinc-500">Quản lý nội dung được cấp quyền và kiểm duyệt nguồn embed.</p></div>
      <a href="/providers" className="text-sm text-zinc-400 hover:text-white">← Provider Sandbox</a>
    </div>
    {!authenticated ? <section className="max-w-xl rounded-2xl border border-white/10 bg-white/[.03] p-6">
      <h2 className="text-lg font-bold">Đăng nhập quản trị</h2><p className="mt-2 text-sm leading-6 text-zinc-500">Nhập ADMIN_CMS_TOKEN đã cấu hình riêng cho môi trường Preview. Token chỉ được giữ trong bộ nhớ trang hiện tại.</p>
      <label className="mt-5 block text-xs font-semibold text-zinc-400">Admin token</label>
      <input type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-3 text-sm outline-none focus:border-red-500" placeholder="Bearer token" />
      <button disabled={!token || busy} onClick={loadCatalog} className="mt-4 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold disabled:opacity-40">{busy ? "Đang kết nối…" : "Kết nối CMS"}</button>
    </section> : <div className="grid gap-8 xl:grid-cols-[minmax(320px,420px)_1fr]">
      <form onSubmit={submit} className="h-fit space-y-4 rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <div><h2 className="text-lg font-bold">Thêm nội dung</h2><p className="mt-1 text-xs text-zinc-500">Mọi nội dung mới sẽ vào trạng thái chờ duyệt.</p></div>
        {[
          ["title","Tiêu đề","text"],["category","Danh mục","text"],["poster_url","Poster URL (HTTPS)","url"],["embed_url","Official player embed URL","url"],["rights_holder","Chủ sở hữu quyền","text"],["license_reference","Mã / đường dẫn giấy phép","text"],["license_expires_at","Ngày hết hạn giấy phép","date"]
        ].map(([key,label,type]) => <label key={key} className="block text-xs font-semibold text-zinc-400">{label}<input required={["title","category","embed_url","rights_holder","license_reference","license_expires_at"].includes(key)} type={type} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-red-500" /></label>)}
        <label className="block text-xs font-semibold text-zinc-400">Mô tả<textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-black px-3 py-2.5 text-sm text-white outline-none focus:border-red-500" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold disabled:opacity-40">{busy ? "Đang xử lý…" : "Gửi duyệt nội dung"}</button>
      </form>
      <section className="min-w-0">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Danh mục nội dung</h2><p className="mt-1 text-xs text-zinc-500">{items.length} mục · cập nhật trực tiếp từ staging database</p></div><button onClick={loadCatalog} disabled={busy} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">Làm mới</button></div>
        <div className="space-y-3">{items.length ? items.map(item => <article key={item.id} className="rounded-xl border border-white/10 bg-white/[.02] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold">{item.title}</h3><p className="mt-1 break-all text-xs text-zinc-500">{item.category} · {item.rights_holder} · hết hạn {item.license_expires_at ? new Date(item.license_expires_at).toLocaleDateString("vi-VN") : "chưa rõ"}</p><p className="mt-2 break-all text-[11px] text-zinc-600">{item.embed_url}</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-zinc-300">{labels[item.status] || item.status}</span></div>
          <div className="mt-4 flex flex-wrap gap-2">{item.status === "pending_review" && <><button disabled={busy} onClick={() => transition(item.id,"approved")} className="rounded-md bg-emerald-700/80 px-3 py-2 text-xs font-bold">Duyệt</button><button disabled={busy} onClick={() => transition(item.id,"rejected")} className="rounded-md bg-white/10 px-3 py-2 text-xs font-bold">Từ chối</button></>}{item.status === "approved" && <button disabled={busy} onClick={() => transition(item.id,"published")} className="rounded-md bg-red-600 px-3 py-2 text-xs font-bold">Phát hành</button>}{!["archived","rejected"].includes(item.status) && <button disabled={busy} onClick={() => transition(item.id,"archived")} className="rounded-md border border-white/10 px-3 py-2 text-xs">Lưu trữ</button>}</div>
        </article>) : <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Chưa có nội dung. Hãy thêm mục đầu tiên từ biểu mẫu.</div>}</div>
      </section>
    </div>}
    {message && <p role="status" className="mt-5 rounded-lg border border-white/10 bg-white/[.03] p-3 text-sm text-zinc-300">{message}</p>}
  </main>;
}
