/**
 * 火山方舟 API 封装（OpenAI 兼容协议 /api/v3）
 */
import { loadConfig } from './config.js'
import { OCR_PROMPT, buildGradePrompt, buildPolishPrompt } from './prompts.js'

async function chatCompletion({ endpoint, messages, responseFormat = null, temperature = 0.3 }) {
  const cfg = loadConfig()
  if (!cfg.apiKey) throw new Error('未配置 API Key')
  if (!endpoint) throw new Error('未配置接入点 ID')

  const body = {
    model: endpoint,
    messages,
    temperature
  }
  if (responseFormat) body.response_format = responseFormat

  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API 调用失败 (${res.status}): ${text}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('API 返回内容为空')
  return content
}

/**
 * OCR：图片 → 文字
 * @param {string} imageDataUrl - data:image/...;base64,xxx
 */
export async function ocrImage(imageDataUrl) {
  const cfg = loadConfig()
  const content = await chatCompletion({
    endpoint: cfg.visionEndpoint,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
    ]
  })
  return content.trim()
}

/**
 * 批改：学生作文 → 结构化批改结果
 */
export async function gradeEssay(studentText, topic = '') {
  const cfg = loadConfig()
  const systemPrompt = buildGradePrompt(topic, cfg.scores)
  const raw = await chatCompletion({
    endpoint: cfg.graderEndpoint,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: studentText }
    ]
  })

  const jsonStr = extractJson(raw)

  try {
    const parsed = JSON.parse(jsonStr)
    return normalizeGradeResult(parsed, cfg.scores)
  } catch (e) {
    throw new Error(`批改结果 JSON 解析失败：${e.message}\n原始返回：${raw.slice(0, 500)}`)
  }
}

/**
 * 从模型返回中抽取 JSON 字符串
 * 兼容三种情况：
 *   1. 纯 JSON
 *   2. 被 ```json ... ``` 包裹
 *   3. 前后有解释文字，但中间夹着一个 JSON 对象
 */
function extractJson(raw) {
  let s = raw.trim()

  // 去掉 markdown 代码块
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) s = fenced[1].trim()

  // 已经是合法 JSON 直接返回
  if (s.startsWith('{') && s.endsWith('}')) return s

  // 兜底：抓第一个 { 到最后一个 } 之间的内容
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first >= 0 && last > first) {
    return s.slice(first, last + 1)
  }
  return s
}

function normalizeGradeResult(data, scoreConfig) {
  const sc = scoreConfig || { content: 4, grammar: 4, style: 2 }
  // 兼容旧字段（language / structure）
  const grammarRaw = data.score?.grammar ?? data.score?.language ?? 0
  const styleRaw = data.score?.style ?? data.score?.structure ?? 0
  const content = clamp(Number(data.score?.content || 0), sc.content)
  const grammar = clamp(Number(grammarRaw), sc.grammar)
  const style = clamp(Number(styleRaw), sc.style)
  const totalRaw = Number(data.score?.total || 0)
  const totalMax = Number(sc.content) + Number(sc.grammar) + Number(sc.style)
  // 模型给的 total 若超出上限，按各项之和兜底
  const total = totalRaw > 0 && totalRaw <= totalMax ? totalRaw : (content + grammar + style)
  return {
    polished: data.polished || '',
    edits: Array.isArray(data.edits) ? data.edits : [],
    score: { content, grammar, style, total },
    comment: data.comment || '',
    critique: data.critique || ''
  }
}

function clamp(n, max) {
  if (Number.isNaN(n) || n < 0) return 0
  return Math.min(n, Number(max) || 0)
}

/**
 * 润色：把批改后的正确作文升级到更高水平
 * @param {string} correctedText - 批改后的正确文本
 * @param {string} topic - 作文题目（可空）
 * @param {string} customRequirement - 教师自定义润色要求（可空）
 */
export async function polishEssay(correctedText, topic = '', customRequirement = '') {
  const cfg = loadConfig()
  const systemPrompt = buildPolishPrompt(topic, customRequirement)
  const raw = await chatCompletion({
    endpoint: cfg.graderEndpoint,
    temperature: 0.6,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: correctedText }
    ]
  })

  const jsonStr = extractJson(raw)

  try {
    const parsed = JSON.parse(jsonStr)
    return normalizePolishResult(parsed)
  } catch (e) {
    throw new Error(`润色结果 JSON 解析失败：${e.message}\n原始返回：${raw.slice(0, 500)}`)
  }
}

function normalizePolishResult(data) {
  return {
    polished: data.polished || '',
    improvements: Array.isArray(data.improvements) ? data.improvements : [],
    summary: data.summary || ''
  }
}
