/**
 * 配置管理：API Key 和接入点 ID（存 localStorage）
 */

const STORAGE_KEY = 'essay-grader-config'

const DEFAULT_CONFIG = {
  apiKey: '',
  visionEndpoint: '', // OCR 视觉模型接入点 ID
  graderEndpoint: '', // 批改文本模型接入点 ID
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  // 评分体系：三个维度的最高分，可自定义
  scores: {
    content: 4,   // 内容分
    grammar: 4,   // 语法分
    style: 2      // 文采分
  }
}

export const SCORE_LABELS = {
  content: '内容',
  grammar: '语法',
  style: '文采'
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneDefault()
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      scores: { ...DEFAULT_CONFIG.scores, ...(parsed.scores || {}) }
    }
  } catch {
    return cloneDefault()
  }
}

function cloneDefault() {
  return {
    ...DEFAULT_CONFIG,
    scores: { ...DEFAULT_CONFIG.scores }
  }
}

export function getTotalMax(cfg) {
  const s = cfg?.scores || DEFAULT_CONFIG.scores
  return Number(s.content || 0) + Number(s.grammar || 0) + Number(s.style || 0)
}

export function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

export function isConfigComplete(cfg) {
  return !!(cfg.apiKey && cfg.visionEndpoint && cfg.graderEndpoint)
}
