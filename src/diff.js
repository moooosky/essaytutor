/**
 * Diff 工具：把原文和修改后文本比对，生成 Word 修订模式风格的渲染数据
 */
import DiffMatchPatch from 'diff-match-patch'

const dmp = new DiffMatchPatch()

/**
 * 生成 word-level diff 段
 * 返回 [{ op: 0|-1|1, text: '...' }]
 *   0  = 不变
 *   -1 = 删除（学生原文）
 *   +1 = 新增（老师修改）
 */
export function diffWords(original, revised) {
  // 先转成"以单词为单位"的对比，避免字符级的破碎结果
  const { chars1, chars2, lineArray } = wordsToChars(original, revised)

  const diffs = dmp.diff_main(chars1, chars2, false)
  dmp.diff_cleanupSemantic(diffs)

  // 把字符还原成单词
  return diffs.map(([op, chars]) => {
    let text = ''
    for (const ch of chars) {
      text += lineArray[ch.charCodeAt(0)]
    }
    return { op, text }
  })
}

/**
 * 把文本切成"单词 + 空白 + 标点"的 token 列表，并映射到字符
 */
function wordsToChars(text1, text2) {
  const lineArray = ['']
  const lineHash = Object.create(null)

  function munge(text) {
    // 切分：单词、空白、标点都作为独立 token
    const tokens = text.match(/[A-Za-z]+|\s+|[^A-Za-z\s]/g) || []
    let chars = ''
    for (const tok of tokens) {
      if (lineHash[tok] !== undefined) {
        chars += String.fromCharCode(lineHash[tok])
      } else {
        if (lineArray.length === 65535) {
          // diff-match-patch 字符表上限
          const rest = tokens.slice(tokens.indexOf(tok)).join('')
          lineArray.push(rest)
          lineHash[rest] = lineArray.length - 1
          chars += String.fromCharCode(lineArray.length - 1)
          break
        }
        lineArray.push(tok)
        lineHash[tok] = lineArray.length - 1
        chars += String.fromCharCode(lineArray.length - 1)
      }
    }
    return chars
  }

  const chars1 = munge(text1)
  const chars2 = munge(text2)
  return { chars1, chars2, lineArray }
}

/**
 * 给一个 diff 段找出对应的"修改理由"
 * 规则：把 edits 中的 original 或 revised 与本段文本做 includes 匹配
 */
export function findReason(segText, edits, op) {
  if (!edits || edits.length === 0) return ''
  const target = segText.trim()
  if (!target) return ''

  for (const edit of edits) {
    if (op === -1 && edit.original && (edit.original.includes(target) || target.includes(edit.original))) {
      return edit.reason || ''
    }
    if (op === 1 && edit.revised && (edit.revised.includes(target) || target.includes(edit.revised))) {
      return edit.reason || ''
    }
  }
  return ''
}
