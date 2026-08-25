/**
 * 批评中引文的解析与上下文定位工具
 *
 * 功能：
 *   - 把含引号的批评文本切成 segments：[{type:'normal'|'quote', text, ...}]
 *   - 对 quote 在学生原文中查找上下文（包含该片段的一句话），并在该句中高亮
 *
 * 引号支持：
 *   "中文双引号"   "smart quotes"   '中文单引号'   "英文双引号"   '英文单引号'
 *   「直角引号」    『书名号』
 */

// 配对的引号字符表 —— [open, close]
const QUOTE_PAIRS = [
  ['“', '”'],   // " "  中文/智能双引号
  ['‘', '’'],   // ' '  中文/智能单引号
  ['"', '"'],             // 英文双引号（同字符配对）
  ["'", "'"],             // 英文单引号（同字符配对）
  ['「', '」'],   // 「 」直角引号
  ['『', '』']    // 『 』书名号
]

/**
 * 把含引号的批评文本切成 segments。
 * 引号本身**不**进入 segment 文本（避免重复显示）。
 * 仅识别"成对出现"的引号；落单引号当作普通字符。
 */
export function parseQuoted(text) {
  if (!text) return []
  const segs = []
  let buf = ''   // 当前累计的普通文本
  let i = 0
  const n = text.length

  while (i < n) {
    const ch = text[i]
    const pair = findOpenPair(ch, text, i)
    if (pair) {
      const [openCh, closeCh] = pair
      // 找到对应的关闭引号
      const closeIdx = findClosingIndex(text, i + 1, openCh, closeCh)
      if (closeIdx > i) {
        // 输出之前累计的普通文本
        if (buf) { segs.push({ type: 'normal', text: buf }); buf = '' }
        const inner = text.slice(i + 1, closeIdx)
        segs.push({ type: 'quote', text: inner, raw: text.slice(i, closeIdx + 1) })
        i = closeIdx + 1
        continue
      }
    }
    buf += ch
    i++
  }

  if (buf) segs.push({ type: 'normal', text: buf })
  return segs
}

/**
 * 在位置 i 是否是某对引号的开引号；
 * 对"同字符"对（"abc" / 'abc'），需要后面还有同样的字符才算开引号
 * （否则像 it's / don't 里的 ' 会误判）
 */
function findOpenPair(ch, text, i) {
  for (const [open, close] of QUOTE_PAIRS) {
    if (ch !== open) continue
    if (open === close) {
      // 同字符配对：要求后面还能找到同字符，且配对内容不为空且不含换行（一般批评不会跨段）
      const after = text.indexOf(close, i + 1)
      if (after > i + 1) return [open, close]
    } else {
      return [open, close]
    }
  }
  return null
}

/**
 * 从 startIdx 起查找首个匹配的关闭引号（同字符对：找下一个；不同字符对：精确匹配）
 * 不允许跨越多于一个换行（避免吃掉整段）
 */
function findClosingIndex(text, startIdx, openCh, closeCh) {
  let newlineCount = 0
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i]
    if (c === '\n') {
      newlineCount++
      if (newlineCount >= 2) return -1
    }
    if (c === closeCh) return i
  }
  return -1
}

/**
 * 在源文本中查找引文片段，返回包含它的"完整一句"上下文 + 命中位置
 *
 * 匹配级别：
 *   1. 精确（区分大小写）
 *   2. 不区分大小写
 *   3. 去除非字母数字字符后的模糊包含（应对单复数 / 标点差异）
 *
 * @returns {null | {sentence:string, hitStart:number, hitEnd:number, level:'exact'|'icase'|'fuzzy'}}
 */
export function findContext(quote, source) {
  if (!quote || !source) return null
  const q = quote.trim()
  if (!q) return null

  // 1) 精确
  let idx = source.indexOf(q)
  if (idx >= 0) return buildSentence(source, idx, q.length, 'exact')

  // 2) 不区分大小写
  const ql = q.toLowerCase()
  const sl = source.toLowerCase()
  idx = sl.indexOf(ql)
  if (idx >= 0) return buildSentence(source, idx, q.length, 'icase')

  // 3) 模糊：把双方都简化为字母数字串，定位
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const qn = norm(q)
  if (qn.length < 3) return null
  // 在源文本上做"按字母数字滑动匹配"
  // 简单做法：构建源文本的"字母数字 → 原索引"映射，然后在压缩串里找子串
  const compactChars = []
  const indexMap = []
  for (let i = 0; i < source.length; i++) {
    const c = source[i].toLowerCase()
    if (/[a-z0-9]/.test(c)) {
      compactChars.push(c)
      indexMap.push(i)
    }
  }
  const compact = compactChars.join('')
  const ci = compact.indexOf(qn)
  if (ci >= 0) {
    const startInSrc = indexMap[ci]
    const endInSrc = indexMap[Math.min(ci + qn.length - 1, indexMap.length - 1)] + 1
    return buildSentence(source, startInSrc, endInSrc - startInSrc, 'fuzzy')
  }

  return null
}

/**
 * 给定源文本和命中区间，返回包含该区间的"完整一句"
 * 句末标点按 . ! ? 。！？ 切（也以换行作为强分隔）
 */
function buildSentence(source, hitStart, hitLen, level) {
  const hitEnd = hitStart + hitLen

  // 向前找最近的句末或段首
  let s = hitStart
  while (s > 0) {
    const c = source[s - 1]
    if (c === '\n' || c === '.' || c === '!' || c === '?' || c === '。' || c === '！' || c === '？') break
    s--
  }
  // 跳过句末标点和前导空白
  while (s < hitStart && /\s/.test(source[s])) s++

  // 向后找最近的句末或段尾
  let e = hitEnd
  while (e < source.length) {
    const c = source[e]
    if (c === '\n') break
    e++
    if (c === '.' || c === '!' || c === '?' || c === '。' || c === '！' || c === '？') break
  }

  const sentence = source.slice(s, e).trim()
  // hit 在 sentence 里的相对位置（按 trim 前的 s 计算偏移；因为 trim 仅可能砍掉前导空白）
  const leadingTrim = source.slice(s).match(/^\s*/)[0].length
  const relStart = hitStart - s - leadingTrim
  const relEnd = relStart + hitLen
  return {
    sentence,
    hitStart: Math.max(0, relStart),
    hitEnd: Math.max(relStart, Math.min(sentence.length, relEnd)),
    level
  }
}
