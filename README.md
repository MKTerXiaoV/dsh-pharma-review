# 市场部体检 · DeepSeek Harness 插件

把医药市场部的五个“体检” skill 装进 DeepSeek Harness（dsh）：交方案之前，先让 AI 挑一遍刺。

| 关 | skill | 老板那句话 |
|---|---|---|
| 证据 | `evidence-review` | 这个数字哪来的？ |
| 分析 | `business-analysis-review` | 所以呢？下一步干什么？ |
| 洞察 | `insight-review` | 这句是洞察还是常识？ |
| 关键信息 | `key-message-review` | 医生记得住吗？ |
| 活动 | `activity-design-review` | 这场活动推动了啥？ |

插件比单装 skill 多三样：

- **五关总体检**：一份完整方案按 证据 → 分析 → 洞察 → 关键信息 → 活动 的顺序过一遍，再查关和关之间有没有断链（比如分析锁定的人群，洞察没接住）。总评跟着最弱的一关走。
- **体检档案**：侧栏“市场部体检”里能看到每次体检的评级和最要命的问题。同一份方案改完点“复检”，会逐条对照上次的问题，档案排成改前改后，哪一关从“未及格线”升到了“良好”一眼看清。
- **校准规则**：你亲手改过、纠正过的判断会记成规则，下次体检先按你的规则判。越用越像你自己的标准。

## 安装

侧栏“插件” → “添加插件”，包名填 `github:MKTerXiaoV/dsh-pharma-review`，装完启用。

命令行（网页版）：

```bash
dsh plugin --profile web add github:MKTerXiaoV/dsh-pharma-review
```

需要 Node.js 22.19 及以上。headless 和 TUI 也能用 skill 和档案工具，只是没有侧栏页面。

## 用法

侧栏点“市场部体检” → “五关总体检”或某一关 → 新对话里贴上材料发送。

也可以直接说：“用关键信息体检帮我看看这条 key message”“五关总体检这份 BSP”“上评审团”（多评委盲审，消耗约标准档 30–50 倍，只在点名时启动）。

## 隐私

档案和校准规则只存在本机 `$DSH_HOME/pharma-review/`。材料会发给你在 dsh 里配置的模型服务商：公司内部材料先把产品名、医院、医生姓名、未公开数据脱敏再贴。

## 来源

`skills/` 是 [pharma-review-skills](https://github.com/MKTerXiaoV/pharma-review-skills) 全家桶的快照（提交号见 `skills/manifest.json`），用 `npm run vendor` 更新，不要手改。五个 skill 在 Claude Code、WorkBuddy 等其他 agent 里也能单独用。

MKTer 小V · 一起进化 · MIT
