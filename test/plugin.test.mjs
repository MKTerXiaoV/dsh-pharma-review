import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
process.env.DSH_HOME = mkdtempSync(join(tmpdir(), 'pr-test-'))
const { createSkillProvider } = await import('../lib/skills.js')
const { recordTool, calibrationTool } = await import('../lib/tools.js')
const { readArchive, removeRecord, dataDir } = await import('../lib/store.js')
const { catalog } = await import('../lib/index.js')
const { GATES, recheckPrompt } = await import('../lib/gates.js')

const provider = createSkillProvider([join(ROOT, 'skills'), join(ROOT, 'own-skills')], ROOT)

test('五个体检 + 五关总体检都注册了，名字合法', async () => {
  const list = await provider.list({})
  assert.deepEqual(list.map((c) => c.name).sort(), [...GATES.map((g) => g.skill), 'pharma-review-five-gates'].sort())
  for (const c of list) {
    assert.match(c.name, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    assert.ok(c.description.length > 40, c.name)
  }
})

test('加载正文：附上插件说明，单项体检讲校准和存档', async () => {
  const list = await provider.list({})
  const km = await provider.get(list.find((c) => c.name === 'key-message-review'), {})
  assert.match(km.content, /## 在市场部体检插件（DSH）里使用/)
  assert.match(km.content, /pharma_review_calibration/)
  assert.match(km.content, /gate: `message`/)
  assert.ok(km.content.includes(join(ROOT, 'skills', 'key-message-review')))
  const five = await provider.get(list.find((c) => c.name === 'pharma-review-five-gates'), {})
  assert.match(five.content, /查断链/)
  assert.match(five.content, /脱敏/)
})

test('快照里没有个人校准和内部交接', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'skills', 'manifest.json'), 'utf8'))
  assert.equal(m.skills.length, 5)
  assert.match(m.commit, /^[0-9a-f]{40}$/)
})

test('存档：校验参数，同名方案排成改前改后，能报出评级变化', async () => {
  await assert.rejects(recordTool.execute({ title: 'x', verdict: 'y', gates: [{ gate: 'nope', grade: '优秀' }] }), /gate 只能是/)
  await assert.rejects(recordTool.execute({ title: 'x', verdict: 'y', gates: [{ gate: 'message', grade: '很好' }] }), /grade 只能是/)
  await assert.rejects(recordTool.execute({ title: 'x', verdict: 'y', gates: [{ gate: 'message', grade: '及格', issues: ['1', '2', '3', '4'] }] }), /至多 3 条/)

  const first = await recordTool.execute({
    title: '某区域推广计划', mode: 'five', verdict: '建议返工', next: '先补证据出处',
    gates: [
      { gate: 'activity', grade: '及格' },
      { gate: 'evidence', grade: '未及格线', issues: ['三个疗效数字无出处'], fix: '补 NCT 号' },
      { gate: 'message', grade: '及格', issues: ['“全面”“优效”是大词'] },
    ],
    chain: ['洞察 → 关键信息：信息没回应洞察里的障碍'],
  })
  assert.equal(first.version, 1)
  assert.equal(first.changes, '')
  const saved = readArchive()[0]
  assert.deepEqual(saved.gates.map((g) => g.gate), ['evidence', 'message', 'activity'], '按五关顺序存')

  const second = await recordTool.execute({ title: '某区域推广计划', verdict: '可以上会', gates: [{ gate: 'evidence', grade: '良好' }, { gate: 'message', grade: '良好' }, { gate: 'activity', grade: '及格' }] })
  assert.equal(second.version, 2)
  assert.equal(second.changes, '和上次比：证据 未及格线→良好，关键信息 及格→良好。')

  const p = recheckPrompt(saved)
  assert.match(p, /复检《某区域推广计划》/)
  assert.match(p, /三个疗效数字无出处/)

  const c = catalog()
  assert.equal(c.records.length, 2)
  assert.ok(c.records.every((r) => r.recheck))
  assert.equal(c.gates.length, 5)

  assert.equal(removeRecord(second.id), true)
  assert.equal(removeRecord('nope'), false)
  assert.equal(readArchive().length, 1)
})

test('校准规则：没有时给默认话，记下后能读到，存在数据目录里', async () => {
  const empty = await calibrationTool.execute({ action: 'show', skill: 'key-message-review' })
  assert.match(empty.text, /还没有校准规则/)
  await assert.rejects(calibrationTool.execute({ action: 'note', skill: 'key-message-review' }), /需要 rule/)
  await assert.rejects(calibrationTool.execute({ action: 'show', skill: 'guizang-ppt-skill' }), /skill 只能是/)
  await calibrationTool.execute({ action: 'note', skill: 'key-message-review', rule: '“一线首选”在有指南推荐时不算大词' })
  const shown = await calibrationTool.execute({ action: 'show', skill: 'key-message-review' })
  assert.match(shown.text, /一线首选/)
  assert.ok(readFileSync(join(dataDir(), 'calibration', 'key-message-review.md'), 'utf8').includes('一线首选'))
})
