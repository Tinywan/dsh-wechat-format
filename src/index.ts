import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import fs from 'node:fs'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { render } from './core/render.js'
import { themes, getTheme, DEFAULT_THEME_ID } from './core/themes.js'

// Node 环境补上浏览器 DOM API（core/highlight.js 依赖 DOMParser/Node）
if (!('DOMParser' in globalThis)) {
  const dom = new JSDOM('<!DOCTYPE html><body></body>')
  ;(globalThis as any).DOMParser = dom.window.DOMParser
  ;(globalThis as any).Node = dom.window.Node
}

export const name = 'wechat-format'
export const inject = ['tools']

const themeIds = themes.map((t) => t.id)

const mimeOf = (file: string) => {
  const ext = path.extname(file).slice(1).toLowerCase()
  return (
    {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
    }[ext] || 'image/png'
  )
}

const basename = (src: string) => {
  const clean = src.split(/[?#]/)[0].replace(/\\/g, '/')
  const segs = clean.split('/')
  return segs[segs.length - 1] || ''
}

// 与 web 版 imageStore.resolve 同规则：按文件名匹配 → base64 data URI
function makeResolver(imageFiles: string[]) {
  const map = new Map<string, string>()
  for (const file of imageFiles) {
    try {
      const buf = fs.readFileSync(file)
      map.set(basename(file).trim().toLowerCase(), `data:${mimeOf(file)};base64,${buf.toString('base64')}`)
    } catch {
      /* 读不到的文件跳过，渲染时会报未匹配警告 */
    }
  }
  return (src: string) => {
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('data:')) return { src, matched: true }
    const data = map.get(basename(src).trim().toLowerCase())
    return data ? { src: data, matched: true } : { src, matched: false }
  }
}

export function apply(ctx: Context) {
  ctx.tools.register(
    defineTool({
      name: 'wechat_format',
      description:
        '将 Markdown 转换为微信公众号正文兼容的全内联样式 HTML（无 class、无 style 块，图片 base64 内嵌），可直接粘贴进公众号编辑器。可选主题：blue-tech 蓝色科技 / orange-heart 橙心 / violet 姹紫 / green 绿意 / night 凝夜 / kami-paper 暖纸 / kimi-blue Kimi 蓝。',
      parameters: {
        markdown: { type: 'string', required: true, description: '文章完整 Markdown 文本' },
        theme: { type: 'string', description: '主题 id，可选 blue-tech / orange-heart / violet / green / night / kami-paper / kimi-blue，默认 blue-tech' },
        imageFiles: { type: 'array', items: { type: 'string' }, description: '文中图片对应的本地文件路径列表，按文件名匹配后以 base64 内嵌' },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            html: { type: 'string' },
            warnings: { type: 'array', items: { type: 'string' } },
            theme: { type: 'string' },
          },
        },
        render: (_args, value: any) => [
          {
            type: 'text',
            text:
              `已生成微信兼容 HTML（${value.html.length} 字符，主题 ${value.theme}），内容可直接粘贴进公众号编辑器。` +
              (value.warnings.length ? `\n警告：${value.warnings.join('；')}` : '') +
              `\n\n${value.html}`,
          },
        ],
      },
      async execute(args: { markdown: string; theme?: string; imageFiles?: string[] }) {
        const themeId = args.theme && themeIds.includes(args.theme) ? args.theme : DEFAULT_THEME_ID
        const warnings: string[] = []
        const env = {
          warnings,
          theme: getTheme(themeId),
          resolveImage: makeResolver(args.imageFiles || []),
        }
        const html = render(args.markdown, env)
        return { html, warnings, theme: themeId }
      },
    }),
  )
}
