// 五关：顺序就是判断流水线的顺序（证据 → 分析 → 洞察 → 关键信息 → 活动）。
// 页面入口、档案、五关总体检都用这一份。ask 是每关老板那句问话，和视频课一致。
export const GATES = [
  { id: 'evidence', skill: 'evidence-review', name: '证据', ask: '这个数字哪来的？', hint: '文献梳理、竞品情报、AI 扒来的循证材料' },
  { id: 'analysis', skill: 'business-analysis-review', name: '分析', ask: '所以呢？下一步干什么？', hint: '区域分析、市场分析、数据解读' },
  { id: 'insight', skill: 'insight-review', name: '洞察', ask: '这句是洞察还是常识？', hint: '客户洞察、患者洞察、BSP 的洞察段' },
  { id: 'message', skill: 'key-message-review', name: '关键信息', ask: '医生记得住吗？', hint: '产品定位、key message、推广话术' },
  { id: 'activity', skill: 'activity-design-review', name: '活动', ask: '这场活动推动了啥？', hint: '会议日程、科室会、论坛方案' },
]

export const FIVE = { id: 'five', skill: 'pharma-review-five-gates', name: '五关总体检', ask: '这份方案，过得了这 5 关吗？' }

// 评级沿用各 skill 评分卡：三档 + 未及格线；五关里材料缺这一部分记「未提交」，合规甲类记「拦停」
export const GRADES = ['拦停', '未及格线', '及格', '良好', '优秀', '未提交']
export const GATE_IDS = GATES.map((g) => g.id)
export const REVIEW_SKILLS = [...GATES.map((g) => g.skill), FIVE.skill]

export const gateOf = (id) => GATES.find((g) => g.id === id)

// 页面上点「开始」：开新对话，把这段草稿填进输入框（不直接发送，用户贴上材料再发）
export function startPrompt(id) {
  if (id === FIVE.id) return '用五关总体检帮我把这份方案从头过一遍：\n\n'
  const g = gateOf(id)
  return g ? `用${g.name}体检帮我看看：\n\n` : ''
}

// 复检：带上上一次的问题，让模型逐条对照改了没有
export function recheckPrompt(record) {
  const lines = [`复检《${record.title}》。这是改后的版本，按上次体检的问题逐条看改没改到位，再给新评级：`, '']
  for (const r of record.gates) {
    if (!r.issues?.length) continue
    lines.push(`【${gateOf(r.gate)?.name || r.gate}】上次 ${r.grade}`)
    for (const i of r.issues) lines.push(`- ${i}`)
  }
  lines.push('', '改后的版本：', '')
  return lines.join('\n')
}
