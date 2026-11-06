// 把五个体检 skill 从全家桶仓库（MKTerXiaoV/pharma-review-skills）的某个提交快照进 skills/。
//   node tools/vendor-skills.mjs              用 GitHub 上 main 的最新提交
//   SRC=~/pharma-review-skills node tools/vendor-skills.mjs   用本地仓库的 HEAD（只取已提交的内容，不带未提交的改动）
// 不进快照：tests/（开发用）、HANDOFF.md（内部交接）、EXTEND.md（个人校准，插件里改走 pharma_review_calibration）
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GATES } from '../lib/gates.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const REPO = 'https://github.com/MKTerXiaoV/pharma-review-skills'
const SKIP = new Set(['tests', 'HANDOFF.md', 'EXTEND.md', '.DS_Store'])

const work = mkdtempSync(join(tmpdir(), 'pr-vendor-'))
let src = process.env.SRC
if (src) {
  execFileSync('git', ['-C', src, 'archive', '--format=tar', '-o', join(work, 'src.tar'), 'HEAD'])
} else {
  execFileSync('git', ['clone', '--depth', '1', '-q', REPO, join(work, 'clone')])
  src = join(work, 'clone')
  execFileSync('git', ['-C', src, 'archive', '--format=tar', '-o', join(work, 'src.tar'), 'HEAD'])
}
const commit = execFileSync('git', ['-C', src, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
mkdirClean(join(work, 'x'))
execFileSync('tar', ['-xf', join(work, 'src.tar'), '-C', join(work, 'x')])

const out = join(ROOT, 'skills')
rmSync(out, { recursive: true, force: true })
const manifest = []
for (const g of GATES) {
  const from = join(work, 'x', 'skills', g.skill)
  if (!existsSync(join(from, 'SKILL.md'))) throw new Error(`全家桶里没有 ${g.skill}`)
  cpSync(from, join(out, g.skill), { recursive: true, filter: (p) => !SKIP.has(p.split('/').pop()) })
  manifest.push({ name: g.skill, files: count(join(out, g.skill)) })
}
writeFileSync(join(out, 'manifest.json'), JSON.stringify({
  $comment: 'tools/vendor-skills.mjs 生成。不要手改 skills/ 下的文件：改全家桶仓库后重新运行脚本。',
  repo: REPO, commit, skills: manifest,
}, null, 2) + '\n')
rmSync(work, { recursive: true, force: true })
console.log(`快照 ${commit.slice(0, 7)}：${manifest.map((m) => `${m.name}(${m.files})`).join('、')}`)

function mkdirClean(d) { rmSync(d, { recursive: true, force: true }); execFileSync('mkdir', ['-p', d]) }
function count(d) { return readdirSync(d, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(join(d, e.name)) : 1), 0) }
