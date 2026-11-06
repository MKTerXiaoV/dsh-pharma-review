// skill 提供方：把插件自带的 skills/<name>/SKILL.md（五个体检，独立仓库的快照）和 own-skills/（五关总体检）注册进 ctx.skills。
// 用户自己在 ~/.dsh/skills 或项目里装了同名 skill 时，那一份优先（rank 600 排在最后）。
// 加载正文时在末尾附上「在 DSH 插件里使用」的说明：skill 目录、校准规则、体检档案。
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { GATES } from './gates.js'

const RANK = 600
const INVOCATION = { modelInvocable: true, userInvocable: true }

function parse(file) {
  const text = readFileSync(file, 'utf8')
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return null
  const field = (k) => (m[1].match(new RegExp(`^${k}:\\s*(.+)$`, 'm')) || [])[1]?.trim().replace(/^(["'])(.*)\1$/, '$2')
  const name = field('name'), description = field('description')
  return name && description ? { name, description, body: text.slice(m[0].length) } : null
}

export function readSkills(dirs) {
  return [].concat(dirs).flatMap((dir) => {
    if (!existsSync(dir)) return []
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'SKILL.md')))
      .map((d) => ({ dir: join(dir, d.name), file: join(dir, d.name, 'SKILL.md'), ...parse(join(dir, d.name, 'SKILL.md')) }))
      .filter((s) => s.name)
  })
}

export function addendum(skill) {
  const gate = GATES.find((g) => g.skill === skill.name)
  const lines = ['', '---', '', '## 在市场部体检插件（DSH）里使用', '']
  if (gate) {
    lines.push(
      `- 本 skill 的目录是 \`${skill.dir}\`，上文的 \`references/\`、\`scripts/\`、\`examples/\` 都相对这个目录。`,
      `- 上文说的 \`EXTEND.md\` 在插件里换成校准规则：开始体检前调用一次 \`pharma_review_calibration\`（action: show，skill: \`${skill.name}\`），有规则就优先按规则判，没有就照常体检，不用向用户提。不要在 skill 目录里写 EXTEND.md，插件更新时会被覆盖。`,
      '- 用户亲手改了你的改写、或纠正了你的判断（“这条不算问题”“我们这样写是有原因的”），提炼成一条规则，用 `pharma_review_calibration`（action: note）记下来，并告诉用户记了什么。这就是上文说的“越用越像你的判断”。',
      `- 给出体检结论后，调用 \`pharma_review_record\` 存进体检档案：gates 只填本关（gate: \`${gate.id}\`），issues 写最要命的至多 3 条，fix 写一条最该先做的改法。用户在侧栏“市场部体检”能看到，改完说“复检”就能对照上次的问题。`,
      '- “改前→改后”对比卡是可选输出：运行脚本报缺少 playwright 时，告诉用户文字体检已经完整、出图可以跳过，不要自行安装依赖。',
    )
  } else {
    lines.push(`- 本 skill 的目录是 \`${skill.dir}\`。`)
  }
  lines.push('- 第一次在这个对话里体检时，提醒用户一句：公司内部材料先把产品名、医院、医生姓名、未公开数据脱敏再贴。说一次就够。')
  return lines.join('\n') + '\n'
}

export function createSkillProvider(dirs, pluginRoot) {
  const candidate = (s) => ({
    name: s.name, description: s.description, path: s.file,
    invocation: INVOCATION, source: 'bundled', provider: 'pharma-review', rank: RANK, locator: s.dir,
    resourceBase: { kind: 'directory', path: s.dir },
  })
  return {
    name: 'pharma-review',
    async list() {
      return readSkills(dirs).map(candidate)
    },
    async get(c) {
      const s = readSkills(dirs).find((x) => x.dir === c.locator && x.name === c.name)
      if (!s) return undefined
      const content = s.body.replaceAll('<SKILL_ROOT>', s.dir).replaceAll('<PLUGIN_ROOT>', pluginRoot) + addendum(s)
      const { rank, locator, ...summary } = candidate(s)
      return { ...summary, content }
    },
  }
}
