/**
 * 涂改标记解析工具
 *
 * OCR 输出可能包含以下标记：
 *   {strike:被划掉的文字}   学生划掉的内容
 *   {insert:插入的文字}     学生添加的内容
 *   {erased}                被完全涂掉/无法辨认的部分
 */

// 同时匹配三类标记，flag 'g' 用于反复 exec
const MARK_RE = /\{(strike|insert):((?:[^{}]|\{(?!strike|insert|erased))*?)\}|\{erased\}/g

/**
 * 把含标记的文本切成 segments
 * @param {string} text
 * @returns {Array<{type:'normal'|'strike'|'insert'|'erased', text:string}>}
 */
export function parseMarks(text) {
  if (!text) return []
  const segs = []
  let lastIndex = 0

  // 重置正则状态
  MARK_RE.lastIndex = 0

  let m
  while ((m = MARK_RE.exec(text)) !== null) {
    // 标记前的普通文本
    if (m.index > lastIndex) {
      segs.push({ type: 'normal', text: text.slice(lastIndex, m.index) })
    }
    if (m[0] === '{erased}') {
      segs.push({ type: 'erased', text: '' })
    } else {
      // m[1] = 'strike' | 'insert', m[2] = 内容
      segs.push({ type: m[1], text: m[2] })
    }
    lastIndex = MARK_RE.lastIndex
  }

  // 末尾剩余普通文本
  if (lastIndex < text.length) {
    segs.push({ type: 'normal', text: text.slice(lastIndex) })
  }
  return segs
}

/**
 * 把含标记的文本清理成"送批改用的纯文本"
 * - {strike:xxx}   → 整段删除（学生已否定）
 * - {insert:xxx}   → 保留 xxx（学生最终表达）
 * - {erased}       → 替换为 [?]（让模型把它当成"看不清"）
 *
 * 处理后还会清理多余的空格（"  " → " "），但保留换行结构。
 */
export function stripMarks(text) {
  if (!text) return ''
  let out = text
    .replace(/\{strike:[^}]*\}/g, '')
    .replace(/\{insert:([^}]*)\}/g, '$1')
    .replace(/\{erased\}/g, '[?]')
  // 行内连续空白合并（不影响换行）
  out = out.replace(/[ \t]+/g, ' ')
  // 行首行尾空格清理（按行）
  out = out.split('\n').map(line => line.trim()).join('\n')
  return out
}

/**
 * 文本里是否存在任何涂改标记
 */
export function hasMarks(text) {
  if (!text) return false
  return /\{(strike|insert):[^}]*\}|\{erased\}/.test(text)
}
