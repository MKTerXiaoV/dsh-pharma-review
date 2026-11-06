// 市场部体检 · DeepSeek Harness 插件：浏览器半边
//   - 侧栏加一个「市场部体检」入口，主区域是插件页面（/pharma-review/，iframe）
//   - 页面里点「开始」「复检」：页面 postMessage 一段草稿，这里开一个新对话并填进输入框（不直接发送，用户贴上材料再发）
window.__ModuleLoader__.load({
  id: 'dsh-pharma-review',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const PANEL = 'pharma-review'
    const SRC = '/pharma-review/'
    const LABEL = '市场部体检'

    // 侧栏图标：一张带勾的体检单
    function ReviewIcon(props) {
      const s = (props && props.size) || 18
      return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' },
        h('path', { d: 'M8 4h-2a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2' }),
        h('rect', { x: 8, y: 2.5, width: 8, height: 3, rx: 1 }),
        h('path', { d: 'M8.5 13l2.5 2.5 4.5-5' }))
    }

    function apply(ctx) {
      // 明暗跟随 dsh：把当前配色发给页面，切换时再发
      const frames = new Set()
      let scheme = null
      const post = (frame) => scheme && frame.contentWindow && frame.contentWindow.postMessage({ type: 'pharma-review:scheme', scheme }, location.origin)
      ctx.inject(['theme'], (c) => {
        const push = (snap) => { scheme = snap.active.colorScheme; frames.forEach(post) }
        push(c.theme.getTheme())
        c.on('theme/change', push)
      })

      function Panel() {
        const ref = React.useRef(null)
        React.useEffect(() => {
          const self = ref.current
          if (self) frames.add(self)
          function onMessage(e) {
            const frame = ref.current
            if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return
            const m = e.data
            if (!m || m.type !== 'pharma-review:start' || typeof m.prompt !== 'string') return
            try {
              ctx.uiWorkspace.startSession(undefined, { prompt: m.prompt, whenDraftExists: 'replace' })
            } catch (err) {
              console.error('[pharma-review] 开新对话失败', err)
              frame.contentWindow.postMessage({ type: 'pharma-review:start-failed', message: String((err && err.message) || err) }, location.origin)
            }
          }
          addEventListener('message', onMessage)
          return () => { removeEventListener('message', onMessage); frames.delete(self) }
        }, [])
        return h('iframe', { ref, src: SRC, title: LABEL, onLoad: (e) => post(e.currentTarget), style: { width: '100%', height: '100%', border: 0, display: 'block' } })
      }
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 7, label: () => LABEL }, ReviewIcon))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, Panel))
    }

    exports.isPlugin = true
    exports.inject = ['slots', 'uiWorkspace']
    exports.apply = apply
    return module.exports
  },
})
