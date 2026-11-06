// 体检档案页面：入口（五关总体检 + 五个单项）、档案列表（同一份方案的多次体检归成一行）、总体检单（可切换历次、看评级变化）
const app = document.getElementById('app')
const SHORT = { 拦停: '停', 未及格线: '✕', 及格: '及', 良好: '良', 优秀: '优', 未提交: '—' }
let data = { gates: [], five: {}, records: [] }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const day = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }
const gateName = (id) => data.gates.find((g) => g.id === id)?.name || id

// 明暗：dsh 发来配色就跟它，否则跟系统
addEventListener('message', (e) => {
  if (e.origin !== location.origin) return
  const m = e.data
  if (m?.type === 'pharma-review:scheme' && (m.scheme === 'dark' || m.scheme === 'light')) document.documentElement.dataset.scheme = m.scheme
  if (m?.type === 'pharma-review:start-failed') toast('没能开新对话：' + m.message)
})

function start(prompt) {
  if (parent === window) { navigator.clipboard?.writeText(prompt); return toast('不在 DSH 里：草稿已复制') }
  parent.postMessage({ type: 'pharma-review:start', prompt }, location.origin)
}

function toast(msg) {
  const t = Object.assign(document.createElement('div'), { className: 'toast', textContent: msg })
  document.body.append(t)
  setTimeout(() => t.remove(), 2400)
}

// 同一份方案（同标题）归一组，按最近一次排序
function groups() {
  const by = new Map()
  for (const r of data.records) (by.get(r.title) || by.set(r.title, []).get(r.title)).push(r)
  return [...by.values()].map((rs) => rs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

function chips(record) {
  const by = new Map(record.gates.map((g) => [g.gate, g.grade]))
  return `<div class="chips">${data.gates.map((g) => {
    const grade = by.get(g.id)
    return grade
      ? `<span class="chip g-${grade}${grade === '未提交' ? ' none' : ''}" title="${esc(g.name)}：${esc(grade)}">${SHORT[grade]}</span>`
      : `<span class="chip none" title="${esc(g.name)}：没体检">·</span>`
  }).join('')}</div>`
}

function home() {
  const gs = groups()
  app.innerHTML = `
    <div class="head"><img src="avatar.png" alt=""><h1>市场部体检</h1></div>
    <button class="five" data-start="five"><div><b>${esc(data.five.name)}</b><span>${esc(data.five.ask)}</span></div><i>开始 →</i></button>
    <div class="gates">${data.gates.map((g, i) => `
      <button class="gate" data-start="${g.id}" title="${esc(g.hint)}">
        <span class="n">0${i + 1}</span><b>${esc(g.name)}</b><span>${esc(g.ask)}</span>
      </button>`).join('')}</div>
    <h2>体检档案</h2>
    ${gs.length ? `<div class="list">${gs.map((rs) => `
      <button class="row" data-open="${rs[0].id}">
        <span><b>${esc(rs[0].title)}</b><div class="meta">${day(rs[0].createdAt)}${rs.length > 1 ? ` · 第 ${rs.length} 次体检` : ''}</div></span>
        ${chips(rs[0])}
      </button>`).join('')}</div>` : '<p class="empty">还没有体检记录。</p>'}`
  app.querySelectorAll('[data-start]').forEach((b) => b.onclick = () => {
    const id = b.dataset.start
    start(id === 'five' ? data.five.prompt : data.gates.find((g) => g.id === id).prompt)
  })
  app.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { location.hash = b.dataset.open })
}

function sheet(id) {
  const r = data.records.find((x) => x.id === id)
  if (!r) { location.hash = ''; return }
  const rs = groups().find((g) => g.some((x) => x.id === id))
  const idx = rs.findIndex((x) => x.id === id)
  const prev = rs[idx + 1]
  const was = new Map(prev ? prev.gates.map((g) => [g.gate, g.grade]) : [])
  app.innerHTML = `
    <button class="back">← 体检档案</button>
    <article class="sheet">
      <h1>《${esc(r.title)}》${r.mode === 'five' ? '五关总体检' : gateName(r.gates[0]?.gate) + '体检'}</h1>
      <div class="meta">${day(r.createdAt)}${r.material ? ' · ' + esc(r.material) : ''}</div>
      ${rs.length > 1 ? `<div class="versions">${rs.map((x, i) => `<button data-v="${x.id}" aria-current="${x.id === id}">第 ${rs.length - i} 次</button>`).reverse().join('')}</div>` : ''}
      <div class="verdict"><p><strong>${esc(r.verdict)}</strong></p>${r.next ? `<p>先改：${esc(r.next)}</p>` : ''}</div>
      ${r.gates.map((g) => `
        <section class="gate-row">
          <div class="name"><b>${esc(gateName(g.gate))}</b><span class="badge g-${g.grade}">${esc(g.grade)}</span>
            ${was.has(g.gate) && was.get(g.gate) !== g.grade ? `<span class="was">上次 ${esc(was.get(g.gate))}</span>` : ''}</div>
          <div>${g.issues?.length ? `<ul>${g.issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p class="muted">${g.grade === '未提交' ? '材料里没有这一部分' : '没有要紧的问题'}</p>`}
            ${g.fix ? `<p class="fix">${esc(g.fix)}</p>` : ''}</div>
        </section>`).join('')}
      ${r.chain?.length ? `<section class="chain"><b>断链</b><ul>${r.chain.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></section>` : ''}
    </article>
    <div class="actions">
      <button class="btn primary" data-act="recheck">复检</button>
      <button class="btn danger" data-act="remove">删除这次</button>
    </div>`
  app.querySelector('.back').onclick = () => { location.hash = '' }
  app.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { location.hash = b.dataset.v })
  app.querySelector('[data-act="recheck"]').onclick = () => start(r.recheck)
  const del = app.querySelector('[data-act="remove"]')
  del.onclick = async () => {
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = '再点一次确认删除'; return }
    const res = await fetch('api/remove', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }).then((x) => x.json()).catch(() => ({}))
    if (!res.ok) return toast('没删掉')
    await load()
    location.hash = ''
  }
  scrollTo(0, 0)
}

function route() { location.hash.length > 1 ? sheet(location.hash.slice(1)) : home() }

async function load() {
  try { data = await fetch('api/catalog', { cache: 'no-store' }).then((r) => r.json()) } catch { app.innerHTML = '<p class="empty">读不到档案。</p>'; return }
  route()
}

addEventListener('hashchange', route)
// 回到页面时刷新：对话里刚存的档案能马上看到
addEventListener('focus', () => load())
document.addEventListener('visibilitychange', () => { if (!document.hidden) load() })
load()
