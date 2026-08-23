// 冒烟测试：不依赖 harness 包，直接验证 vendored 核心 + 插件的渲染/图片解析逻辑
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><body></body>')
globalThis.DOMParser = dom.window.DOMParser
globalThis.Node = dom.window.Node

const { render } = await import('./src/core/render.js')
const { themes, getTheme, DEFAULT_THEME_ID } = await import('./src/core/themes.js')

// 复刻 index.ts 的图片解析逻辑
const basename = (src) => src.split(/[?#]/)[0].replace(/\\/g, '/').split('/').pop() || ''
function makeResolver(imageFiles) {
  const map = new Map()
  for (const file of imageFiles) {
    try {
      const buf = fs.readFileSync(file)
      const ext = path.extname(file).slice(1).toLowerCase()
      const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }[ext] || 'image/png'
      map.set(basename(file).trim().toLowerCase(), `data:${mime};base64,${buf.toString('base64')}`)
    } catch {}
  }
  return (src) => {
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return { src, matched: true }
    const data = map.get(basename(src).trim().toLowerCase())
    return data ? { src: data, matched: true } : { src, matched: false }
  }
}

// 造一张 1x1 PNG 测试图
const tmpImg = path.resolve('test-tmp.png')
fs.writeFileSync(tmpImg, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'))

const md = fs.readFileSync(path.resolve('assets/sample.md'), 'utf-8')

const results = []
const check = (name, ok) => results.push([name, ok])

// 1) 默认主题渲染
const env = { warnings: [], theme: getTheme(DEFAULT_THEME_ID), resolveImage: makeResolver([tmpImg]) }
const html = render(md, env)
check('默认主题容器 677px', html.includes('max-width:677px'))
check('h1 描边数字色块', html.includes('width:26px;height:26px') && html.includes('border:1px solid #2273b8'))
check('无 class/style 块/ul', !/class=/.test(html) && !/<style/.test(html) && !/<\/?(ul|ol)[\s>]/.test(html))
check('字体栈完整', html.includes('font-family:Optima,PingFangSC-regular,serif'))

// 2) 图片文件名匹配 → base64 内嵌
const envImg = { warnings: [], theme: getTheme(DEFAULT_THEME_ID), resolveImage: makeResolver([tmpImg]) }
const htmlImg = render('# t\n\n![test-tmp.png](imgs/test-tmp.png)\n', envImg)
check('图片 base64 内嵌', htmlImg.includes('src="data:image/png;base64,'))
check('图注自动编号', htmlImg.includes('图 1 ·'))
check('图片无未匹配警告', envImg.warnings.length === 0)

// 3) 未匹配图片 → 警告
const envMiss = { warnings: [], theme: getTheme(DEFAULT_THEME_ID), resolveImage: makeResolver([]) }
render('![missing](no-such.png)', envMiss)
check('未匹配图片产生警告', envMiss.warnings.length === 1)

// 4) 七套主题均可渲染且合规
for (const t of themes) {
  const e = { warnings: [], theme: t.theme }
  const out = render(md, e)
  check(`主题 ${t.id} 合规`, out.length > 1000 && !/class=/.test(out))
}
check('orange-heart 取色', render('**x**', { warnings: [], theme: getTheme('orange-heart') }).includes('') && getTheme('orange-heart').colors.primary === '#ff3502')

fs.rmSync(tmpImg)

let fail = 0
for (const [name, ok] of results) {
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${name}`)
}
console.log(fail ? `\n${fail} 项失败` : '\n全部通过 ✓')
process.exit(fail ? 1 : 0)
