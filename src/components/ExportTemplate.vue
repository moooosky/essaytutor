<script setup>
import { computed } from 'vue'
import { diffWords, findReason } from '../diff.js'
import { getTotalMax } from '../config.js'

const props = defineProps({
  imageUrl: { type: String, default: '' },
  ocrText: { type: String, default: '' },
  topic: { type: String, default: '' },
  result: { type: Object, default: null },
  date: { type: String, default: '' },
  scoreConfig: { type: Object, default: () => ({ content: 4, grammar: 4, style: 2 }) }
})

const gradeDiff = computed(() => {
  if (!props.result) return []
  return diffWords(props.ocrText, props.result.polished)
})

function reasonForGrade(seg) {
  return findReason(seg.text, props.result?.edits || [], seg.op)
}

const scoreCfg = computed(() => props.scoreConfig)
const totalMax = computed(() => getTotalMax({ scores: scoreCfg.value }))
</script>

<template>
  <div v-if="result" class="export-root">
    <!-- 报告抬头 -->
    <div class="header">
      <div class="title">英语作文批改报告</div>
      <div class="meta">
        <span v-if="topic">题目：{{ topic }}</span>
        <span class="date">批改日期：{{ date }}</span>
      </div>
    </div>

    <!-- 一、原作图片 -->
    <section class="section">
      <div class="sec-title">一、学生原作</div>
      <div class="image-wrap">
        <img v-if="imageUrl" :src="imageUrl" alt="作文原图" />
      </div>
    </section>

    <!-- 二、批改结果（红字 diff） -->
    <section class="section">
      <div class="sec-title">二、批改结果（红字标注）</div>
      <div class="diff-view">
        <template v-for="(seg, i) in gradeDiff" :key="i">
          <span v-if="seg.op === 0" class="seg-keep">{{ seg.text }}</span>
          <span v-else-if="seg.op === -1" class="seg-del" :title="reasonForGrade(seg)">{{ seg.text }}</span>
          <span v-else-if="seg.op === 1" class="seg-ins" :title="reasonForGrade(seg)">{{ seg.text }}</span>
        </template>
      </div>
    </section>

    <!-- 三、评分 -->
    <section class="section">
      <div class="sec-title">三、评分</div>
      <div class="score-row">
        <div class="score-cell">
          <div class="num">{{ result.score.content }}<span class="den">/{{ scoreCfg.content }}</span></div>
          <div class="lbl">内容</div>
        </div>
        <div class="score-cell">
          <div class="num">{{ result.score.grammar }}<span class="den">/{{ scoreCfg.grammar }}</span></div>
          <div class="lbl">语法</div>
        </div>
        <div class="score-cell">
          <div class="num">{{ result.score.style }}<span class="den">/{{ scoreCfg.style }}</span></div>
          <div class="lbl">文采</div>
        </div>
        <div class="divider"></div>
        <div class="score-cell total">
          <div class="num">{{ result.score.total }}<span class="den">/{{ totalMax }}</span></div>
          <div class="lbl">总分</div>
        </div>
      </div>
    </section>

    <!-- 四、总评 -->
    <section v-if="result.comment" class="section">
      <div class="sec-title">四、总评（评分理由）</div>
      <div class="comment-text">{{ result.comment }}</div>
    </section>

    <!-- 五、批评 -->
    <section v-if="result.critique" class="section">
      <div class="sec-title">五、批评（不足与改进）</div>
      <div class="critique-text">{{ result.critique }}</div>
    </section>
  </div>
</template>

<style scoped>
/* PDF 专用排版（A4 宽 794px @ 96dpi） */
.export-root {
  width: 794px;
  padding: 40px 48px;
  background: #fff;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 14px;
  line-height: 1.7;
  box-sizing: border-box;
}

.header {
  text-align: center;
  padding-bottom: 16px;
  border-bottom: 2px solid #1f2937;
  margin-bottom: 24px;
}
.title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.meta {
  display: flex;
  justify-content: center;
  gap: 24px;
  font-size: 13px;
  color: #6b7280;
}
.meta .date { color: #9ca3af; }

.section {
  margin-bottom: 22px;
}
.sec-title {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  border-left: 4px solid #3b82f6;
  padding-left: 10px;
  margin-bottom: 10px;
}

/* 图片：按比例缩放，限制最大高度避免占满整页 */
.image-wrap {
  text-align: center;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
}
.image-wrap img {
  max-width: 100%;
  max-height: 480px;
  object-fit: contain;
  display: inline-block;
}

/* Diff —— 与主界面保持一致 */
.diff-view {
  padding: 16px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
  font-size: 14px;
  line-height: 2;
  white-space: pre-wrap;
  word-break: break-word;
}
.seg-keep { color: #1f2937; }
.seg-del {
  color: #dc2626;
  text-decoration: line-through;
  text-decoration-color: #dc2626;
  text-decoration-thickness: 2px;
}
.seg-ins {
  color: #dc2626;
  font-weight: 600;
  background: #fef2f2;
  padding: 0 2px;
  border-radius: 3px;
}

/* 分数 */
.score-row {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 14px 22px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: linear-gradient(135deg, #fafbfc, #f3f4f6);
}
.score-cell {
  text-align: center;
}
.score-cell .num {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.score-cell .den {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 400;
  margin-left: 2px;
}
.score-cell .lbl {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.score-cell.total .num {
  color: #3b82f6;
  font-size: 26px;
}
.divider {
  width: 1px;
  height: 36px;
  background: #d1d5db;
}

/* 总评 */
.comment-text {
  padding: 12px 14px;
  background: #f9fafb;
  border-radius: 6px;
  border-left: 3px solid #3b82f6;
  font-size: 13.5px;
  line-height: 1.85;
  color: #374151;
  white-space: pre-wrap;
}

/* 批评 */
.critique-text {
  padding: 12px 14px;
  background: #fffbeb;
  border-radius: 6px;
  border-left: 3px solid #f59e0b;
  font-size: 13.5px;
  line-height: 1.85;
  color: #78350f;
  white-space: pre-wrap;
}
</style>
