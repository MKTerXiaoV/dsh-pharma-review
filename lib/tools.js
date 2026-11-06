// 插件注册给模型的两个工具。在 Host 进程里执行，不经过模型的 bash 沙箱：
// 档案和校准规则在工作区外（$DSH_HOME/pharma-review），沙箱里的脚本写不进去。
import { GATE_IDS, GATES, GRADES, REVIEW_SKILLS } from './gates.js'
import { addCalibration, addRecord, readCalibration, versionsOf } from './store.js'

const text = (value) => [{ type: 'text', text: value }]
const fail = (errs) => { if (errs.length) throw new Error(errs.join('；')) }
const isStr = (v) => typeof v === 'string' && v.trim() !== ''
const MAX = { title: 80, verdict: 300, issue: 200, fix: 200, chain: 200, next: 200, material: 120, rule: 400 }

const RECORD_PARAMS = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'gates', 'verdict'],
  properties: {
    title: { type: 'string', description: '方案名（脱敏后的叫法）。同一份方案复检时用同一个名字，档案才能排成改前改后' },
    material: { type: 'string', description: '材料是什么，一句话，例如“2027 区域推广计划 · 12 页”' },
    mode: { type: 'string', enum: ['single', 'five'], description: 'single：单项体检；five：五关总体检' },
    gates: {
      type: 'array',
      minItems: 1,
      maxItems: 5,
      description: '每关一条。单项体检只填本关',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['gate', 'grade'],
        properties: {
          gate: { type: 'string', enum: GATE_IDS, description: GATES.map((g) => `${g.id}=${g.name}`).join('，') },
          grade: { type: 'string', enum: GRADES, description: '拦停=合规甲类整份拦停；未提交=材料里没有这一部分' },
          issues: { type: 'array', maxItems: 3, items: { type: 'string' }, description: '最要命的至多 3 条，每条一句话' },
          fix: { type: 'string', description: '这一关最该先做的一条改法' },
        },
      },
    },
    chain: { type: 'array', maxItems: 3, items: { type: 'string' }, description: '五关总体检：上下游断链的地方，至多 3 处' },
    verdict: { type: 'string', description: '总评一句话' },
    next: { type: 'string', description: '先改哪里' },
  },
}

function checkRecord(a) {
  const errs = []
  for (const k of Object.keys(a || {})) if (!RECORD_PARAMS.properties[k]) errs.push(`未知参数 ${k}`)
  if (!isStr(a?.title)) errs.push('缺少 title')
  if (!isStr(a?.verdict)) errs.push('缺少 verdict')
  if (a?.mode !== undefined && !['single', 'five'].includes(a.mode)) errs.push('mode 只能是 single / five')
  if (!Array.isArray(a?.gates) || !a.gates.length || a.gates.length > 5) errs.push('gates 要 1–5 条')
  const seen = new Set()
  for (const g of a?.gates || []) {
    if (!GATE_IDS.includes(g?.gate)) errs.push(`gate 只能是 ${GATE_IDS.join(' / ')}`)
    else if (seen.has(g.gate)) errs.push(`${g.gate} 重复`)
    else seen.add(g.gate)
    if (!GRADES.includes(g?.grade)) errs.push(`grade 只能是 ${GRADES.join(' / ')}`)
    if (g?.issues !== undefined && (!Array.isArray(g.issues) || g.issues.length > 3 || !g.issues.every(isStr))) errs.push('issues 是至多 3 条的字符串数组')
    if (g?.fix !== undefined && typeof g.fix !== 'string') errs.push('fix 应该是字符串')
    for (const k of Object.keys(g || {})) if (!['gate', 'grade', 'issues', 'fix'].includes(k)) errs.push(`gates 里有未知字段 ${k}`)
  }
  if (a?.chain !== undefined && (!Array.isArray(a.chain) || a.chain.length > 3 || !a.chain.every(isStr))) errs.push('chain 是至多 3 条的字符串数组')
  for (const k of ['material', 'next']) if (a?.[k] !== undefined && typeof a[k] !== 'string') errs.push(`${k} 应该是字符串`)
  fail(errs)
}

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

export const recordTool = {
  name: 'pharma_review_record',
  description: '把一次体检的结论存进本机的体检档案（侧栏“市场部体检”里能看到）。同一份方案用同一个 title，多次体检会排成改前改后。',
  parameters: RECORD_PARAMS,
  output: {
    schema: { type: 'object', additionalProperties: false, required: ['id', 'version', 'changes'], properties: { id: { type: 'string' }, version: { type: 'integer' }, changes: { type: 'string' } } },
    render: (_a, v) => text(`已存档（第 ${v.version} 次体检）。${v.changes}用户可以在侧栏“市场部体检”里看到。`),
  },
  async execute(a) {
    checkRecord(a)
    const title = clip(a.title.trim(), MAX.title)
    const prev = versionsOf(title)[0]
    const order = new Map(GATE_IDS.map((id, i) => [id, i]))
    const r = addRecord({
      title,
      material: a.material ? clip(a.material.trim(), MAX.material) : '',
      mode: a.mode || (a.gates.length > 1 ? 'five' : 'single'),
      gates: [...a.gates].sort((x, y) => order.get(x.gate) - order.get(y.gate)).map((g) => ({
        gate: g.gate, grade: g.grade,
        issues: (g.issues || []).map((s) => clip(s.trim(), MAX.issue)),
        fix: g.fix ? clip(g.fix.trim(), MAX.fix) : '',
      })),
      chain: (a.chain || []).map((s) => clip(s.trim(), MAX.chain)),
      verdict: clip(a.verdict.trim(), MAX.verdict),
      next: a.next ? clip(a.next.trim(), MAX.next) : '',
    })
    return { id: r.id, version: versionsOf(r.title).length, changes: prev ? diffText(prev, r) : '' }
  },
}

// 和上一次比：哪几关评级变了
export function diffText(prev, cur) {
  const name = (id) => GATES.find((g) => g.id === id)?.name || id
  const was = new Map(prev.gates.map((g) => [g.gate, g.grade]))
  const moved = cur.gates.filter((g) => was.has(g.gate) && was.get(g.gate) !== g.grade).map((g) => `${name(g.gate)} ${was.get(g.gate)}→${g.grade}`)
  return moved.length ? `和上次比：${moved.join('，')}。` : '和上次比，评级没有变化。'
}

const CAL_PARAMS = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'skill'],
  properties: {
    action: { type: 'string', enum: ['show', 'note'], description: 'show：读这个 skill 的校准规则；note：追加一条' },
    skill: { type: 'string', enum: REVIEW_SKILLS, description: '哪个体检 skill 的规则' },
    rule: { type: 'string', description: 'note 时必填：一条规则，写清用户原话或改法、以后怎么判' },
  },
}

export const calibrationTool = {
  name: 'pharma_review_calibration',
  description: '读写用户对某个体检 skill 的校准规则（本机 Markdown，替代 EXTEND.md）。体检前 show 一次；用户亲手改了改写或纠正了判断时 note 一条。',
  parameters: CAL_PARAMS,
  output: {
    schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } } },
    render: (_a, v) => text(v.text),
  },
  async execute(a) {
    const errs = []
    for (const k of Object.keys(a || {})) if (!CAL_PARAMS.properties[k]) errs.push(`未知参数 ${k}`)
    if (!['show', 'note'].includes(a?.action)) errs.push('action 只能是 show / note')
    if (!REVIEW_SKILLS.includes(a?.skill)) errs.push(`skill 只能是 ${REVIEW_SKILLS.join(' / ')}`)
    if (a?.action === 'note' && !isStr(a?.rule)) errs.push('note 需要 rule')
    fail(errs)
    if (a.action === 'show') return { text: readCalibration(a.skill) ?? '还没有校准规则，按 skill 的通用规则体检。' }
    addCalibration(a.skill, clip(a.rule.trim(), MAX.rule))
    return { text: '已记下。下次体检会先按这条判。' }
  },
}

export const TOOLS = [recordTool, calibrationTool]
