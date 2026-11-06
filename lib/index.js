// 市场部体检 · DeepSeek Harness 插件：Host 半边
// 1. 把五个体检 skill（skills/，独立仓库快照）和五关总体检（own-skills/）注册进 ctx.skills
//    以及给模型的两个工具（lib/tools.js）：存体检档案、读写校准规则
// 2. /pharma-review/             体检档案页面（page/）
//    /pharma-review/api/catalog  五关、档案
//    /pharma-review/api/remove   删除一条档案
import { createReadStream, existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIVE, GATES, GRADES, recheckPrompt, startPrompt } from './gates.js'
import { createSkillProvider } from './skills.js'
import { readArchive, removeRecord } from './store.js'
import { TOOLS } from './tools.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BASE = '/pharma-review'
const SKILL_DIRS = [join(ROOT, 'skills'), join(ROOT, 'own-skills')]

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
}

export const name = 'pharma-review'
// webServer 是可选的：headless / TUI 没有网页服务，skill 和工具照样要能用
export const inject = ['skills', 'tools']

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}
function notFound(res) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('not found')
}

// 只在 dir 里面找文件：拒绝 ..、点文件和目录外的符号链接
function safeFile(dir, rel) {
  if (rel.split('/').some((p) => p.startsWith('.'))) return null
  let base
  try { base = realpathSync(dir) } catch { return null }
  const file = normalize(join(base, rel))
  if (!file.startsWith(base + sep) || !existsSync(file)) return null
  const real = realpathSync(file)
  return real.startsWith(base + sep) && statSync(real).isFile() ? real : null
}

// 只接受同源页面发来的 JSON
function readJson(req, max = 4 * 1024) {
  return new Promise((resolve, reject) => {
    const origin = req.headers.origin
    if (req.method !== 'POST') return reject(Object.assign(new Error('method'), { status: 405 }))
    if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return reject(Object.assign(new Error('type'), { status: 415 }))
    if (origin && origin.replace(/^https?:\/\//, '') !== req.headers.host) return reject(Object.assign(new Error('origin'), { status: 403 }))
    let size = 0
    const chunks = []
    req.on('data', (c) => { size += c.length; if (size > max) req.destroy(); else chunks.push(c) })
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch (e) { reject(Object.assign(e, { status: 400 })) } })
    req.on('error', reject)
  })
}

export function catalog() {
  return {
    version: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
    gates: GATES.map((g) => ({ ...g, prompt: startPrompt(g.id) })),
    five: { ...FIVE, prompt: startPrompt(FIVE.id) },
    grades: GRADES,
    records: readArchive().map((r) => ({ ...r, recheck: recheckPrompt(r) })),
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.skills.registerProvider(() => createSkillProvider(SKILL_DIRS, ROOT)))
  for (const tool of TOOLS) ctx.tools.register(tool)

  ctx.inject(['webServer'], (c) => c.effect(() =>
    c.webServer.register({
      kind: 'prefix',
      path: BASE,
      async handler(req, res) {
        const url = new URL(req.url || '/', 'http://x')
        const rest = decodeURIComponent(url.pathname.slice(BASE.length)) || '/'
        if (rest === '/api/catalog') return sendJson(res, 200, catalog())
        if (rest === '/api/remove') {
          try {
            const body = await readJson(req)
            return sendJson(res, 200, { ok: removeRecord(String(body.id || '')) })
          } catch (e) {
            return sendJson(res, e.status || 400, { ok: false, error: e.message })
          }
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res)
        const f = safeFile(join(ROOT, 'page'), rest === '/' ? 'index.html' : rest.slice(1))
        if (!f) return notFound(res)
        res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] || 'application/octet-stream', 'content-length': statSync(f).size, 'cache-control': 'no-cache' })
        if (req.method === 'HEAD') return res.end()
        createReadStream(f).pipe(res)
      },
    }),
  ))
}
