<script setup>
import { ref, computed, watch } from 'vue'
import { diffWords, findReason } from '../diff.js'
import { getTotalMax } from '../config.js'
import { parseMarks, hasMarks } from '../utils/marks.js'
import { parseQuoted, findContext } from '../utils/quoteContext.js'
import ExportTemplate from './ExportTemplate.vue'
import { exportNodeToPdf, buildPdfFileName, todayDateString } from '../utils/exportPdf.js'

const props = defineProps({
  // 'idle' | 'ocr' | 'edit' | 'grading' | 'result'
  stage: { type: String, default: 'idle' },
  ocrText: { type: String, default: '' },
  topic: { type: String, default: '' },
  result: { type: Object, default: null },
  polishResult: { type: Object, default: null },
  viewMode: { type: String, default: 'grade' },   // 'grade' | 'polish'
  loading: { type: Boolean, default: false },
  loadingText: { type: String, default: '' },
  errorMsg: { type: String, default: '' },
  hasImage: { type: Boolean, default: false },
  imageUrl: { type: String, default: '' },
  imageFileName: { type: String, default: '' },
  scoreConfig: { type: Object, default: () => ({ content: 4, grammar: 4, style: 2 }) },
  polishRequirement: { type: String, default: '' }
})
const emit = defineEmits([
  'run-ocr',
  'update:ocrText',
  'update:topic',
  'update:polishRequirement',
  'run-grade',
  'run-polish',
  'switch-view',
  'reset'
])

const editedText = ref(props.ocrText)
watch(() => props.ocrText, (v) => { editedText.value = v })
watch(editedText, (v) => emit('update:ocrText', v))

const topicVal = ref(props.topic)
watch(() => props.topic, (v) => { topicVal.value = v })
watch(topicVal, (v) => emit('update:topic', v))

// 润色自定义要求双向绑定
const polishReqVal = ref(props.polishRequirement)
watch(() => props.polishRequirement, (v) => { polishReqVal.value = v })
watch(polishReqVal, (v) => emit('update:polishRequirement', v))

// 已润色后默认折叠"调整要求"面板
const reqPanelOpen = ref(false)

// 涂改标记预览（基于 textarea 实时内容）
const showMarksPreview = computed(() => hasMarks(editedText.value))
const marksSegments = computed(() => parseMarks(editedText.value))

/**
 * 批评 segments —— 把引号包裹的片段标记为可悬浮节点。
 * 引文上下文从"批改后的 polished"和"学生原文 ocrText"里查找：
 *   - 优先在 polished 里找（因为模型批评一般引用的是它收到的文本）
 *   - 找不到再在 ocrText 里找（兜底）
 * 找到后，segment 上挂 sentence / hitStart / hitEnd 用于 tooltip 渲染
 */
const critiqueSegments = computed(() => {
  const text = props.result?.critique
  if (!text) return []
  const raw = parseQuoted(text)
  return raw.map(seg => {
    if (seg.type !== 'quote') return seg
    // 引号里若不含英文字母（纯中文/数字/标点），不视为对原文的引用 —— 降级为普通文本
    // 重新加回引号字符显示，避免视觉上引号丢失
    if (!/[A-Za-z]/.test(seg.text)) {
      return { type: 'normal', text: seg.raw || `"${seg.text}"` }
    }
    const ctx = findContext(seg.text, props.result?.polished || '')
            || findContext(seg.text, props.ocrText || '')
    return ctx ? { ...seg, ...ctx, found: true } : { ...seg, found: false }
  })
})

// 红字 diff: 学生原文 → 批改版
const gradeDiff = computed(() => {
  if (!props.result) return []
  return diffWords(props.ocrText, props.result.polished)
})

// 蓝字 diff: 批改版 → 润色版
const polishDiff = computed(() => {
  if (!props.result || !props.polishResult) return []
  return diffWords(props.result.polished, props.polishResult.polished)
})

function reasonForGrade(seg) {
  return findReason(seg.text, props.result?.edits || [], seg.op)
}

function reasonForPolish(seg) {
  return findReason(seg.text, props.polishResult?.improvements || [], seg.op)
}

// 复制润色版纯文本
const copyTip = ref('')
async function copyPolished() {
  if (!props.polishResult?.polished) return
  try {
    await navigator.clipboard.writeText(props.polishResult.polished)
    copyTip.value = '已复制'
  } catch {
    copyTip.value = '复制失败'
  }
  setTimeout(() => { copyTip.value = '' }, 1500)
}

// 评分配置（来自父组件，保证设置变更后及时响应）
const scoreCfg = computed(() => props.scoreConfig)
const scoreTotalMax = computed(() => getTotalMax({ scores: scoreCfg.value }))

// PDF 导出
const exportRoot = ref(null)
const exporting = ref(false)
const todayStr = todayDateString()

async function exportPdf() {
  if (!props.result) return
  if (exporting.value) return
  exporting.value = true
  try {
    // 等下一帧确保隐藏节点已渲染
    await new Promise(r => requestAnimationFrame(r))
    const fileName = buildPdfFileName(props.imageFileName)
    await exportNodeToPdf(exportRoot.value, fileName)
  } catch (e) {
    alert('导出失败：' + e.message)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <div class="right-panel">
    <!-- 顶部步骤指示（三步） -->
    <div class="steps">
      <span class="step" :class="{ active: stage === 'edit', done: ['result'].includes(stage) }">
        ① 识别 / 校对
      </span>
      <span class="arrow">→</span>
      <span class="step" :class="{
        active: stage === 'result' && viewMode === 'grade',
        done: stage === 'result' && !!polishResult
      }">
        ② 批改
      </span>
      <span class="arrow">→</span>
      <span class="step" :class="{
        active: stage === 'result' && viewMode === 'polish',
        done: !!polishResult && viewMode !== 'polish'
      }">
        ③ 润色
      </span>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="error-banner">
      ⚠️ {{ errorMsg }}
    </div>

    <!-- 加载中 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <div>{{ loadingText || '处理中...' }}</div>
    </div>

    <!-- 阶段：空闲 -->
    <div v-else-if="stage === 'idle'" class="empty-state">
      <div class="es-icon">✏️</div>
      <div class="es-title">还没有作文</div>
      <div class="es-hint">在左侧上传作文图片，点击「开始识别」即可</div>
      <button class="btn-primary" :disabled="!hasImage" @click="emit('run-ocr')">
        开始识别
      </button>
    </div>

    <!-- 阶段：编辑校对 -->
    <div v-else-if="stage === 'edit'" class="edit-area">
      <div class="block">
        <label class="lbl">作文题目（选填）</label>
        <input
          v-model="topicVal"
          class="topic-input"
          placeholder="如：My Favorite Hobby"
        />
      </div>
      <div class="block flex-grow">
        <label class="lbl">识别结果（请校对，可直接修改）</label>
        <textarea
          v-model="editedText"
          class="ocr-textarea"
          spellcheck="false"
          placeholder="OCR 结果将显示在此处..."
        ></textarea>

        <!-- 涂改预览（仅当文本里有 {strike}/{insert}/{erased} 标记时显示） -->
        <div v-if="showMarksPreview" class="marks-preview">
          <div class="mp-head">
            <span class="mp-title">📝 涂改预览</span>
            <span class="mp-legend">
              <span class="lg-strike">划掉</span>
              <span class="lg-insert">插入</span>
              <span class="lg-erased">[涂掉]</span>
            </span>
          </div>
          <div class="mp-body">
            <template v-for="(seg, i) in marksSegments" :key="i">
              <span v-if="seg.type === 'normal'" class="mp-normal">{{ seg.text }}</span>
              <span v-else-if="seg.type === 'strike'" class="mp-strike">{{ seg.text }}</span>
              <span v-else-if="seg.type === 'insert'" class="mp-insert">{{ seg.text }}</span>
              <span v-else-if="seg.type === 'erased'" class="mp-erased">[涂掉]</span>
            </template>
          </div>
          <div class="mp-hint">
            提示：批改前会自动把"划掉"内容删除、保留"插入"内容、把"[涂掉]"作为不可辨认处理。可直接在上方文本框里手动调整。
          </div>
        </div>
      </div>
      <div class="action-bar">
        <button class="btn-secondary" @click="emit('run-ocr')">↻ 重新识别</button>
        <div class="spacer"></div>
        <button
          class="btn-primary"
          :disabled="!editedText.trim()"
          @click="emit('run-grade')"
        >
          ✓ 校对完成，开始批改
        </button>
      </div>
    </div>

    <!-- 阶段：批改 / 润色结果 -->
    <div v-else-if="stage === 'result' && result" class="result-area">
      <div class="action-bar top-bar">
        <button class="btn-secondary" @click="emit('reset')">↻ 重新批改</button>
        <button
          v-if="viewMode === 'grade'"
          class="btn-secondary"
          :disabled="exporting"
          @click="exportPdf"
        >{{ exporting ? '⏳ 导出中...' : '📥 导出批改' }}</button>
        <span v-if="topic" class="topic-tag">📌 {{ topic }}</span>
        <div class="spacer"></div>

        <!-- 视图切换 -->
        <div class="view-tabs">
          <button
            class="tab"
            :class="{ active: viewMode === 'grade' }"
            @click="emit('switch-view', 'grade')"
          >📝 批改</button>
          <button
            class="tab"
            :class="{ active: viewMode === 'polish' }"
            @click="emit('switch-view', 'polish')"
          >✨ 润色</button>
        </div>
      </div>

      <!-- 批改视图（红字） -->
      <template v-if="viewMode === 'grade'">
        <div class="block flex-grow">
          <label class="lbl">批改结果 · Word 修订模式（红字）</label>
          <div class="diff-view">
            <template v-for="(seg, i) in gradeDiff" :key="i">
              <span v-if="seg.op === 0" class="seg-keep">{{ seg.text }}</span>
              <span
                v-else-if="seg.op === -1"
                class="seg-del"
                :title="reasonForGrade(seg)"
              >{{ seg.text }}</span>
              <span
                v-else-if="seg.op === 1"
                class="seg-ins"
                :title="reasonForGrade(seg)"
              >{{ seg.text }}</span>
            </template>
          </div>
        </div>

        <!-- 分数卡片 -->
        <div class="score-card">
          <div class="scores">
            <div class="score-item">
              <div class="num">{{ result.score.content }}<span class="den">/{{ scoreCfg.content }}</span></div>
              <div class="label">内容</div>
            </div>
            <div class="score-item">
              <div class="num">{{ result.score.grammar }}<span class="den">/{{ scoreCfg.grammar }}</span></div>
              <div class="label">语法</div>
            </div>
            <div class="score-item">
              <div class="num">{{ result.score.style }}<span class="den">/{{ scoreCfg.style }}</span></div>
              <div class="label">文采</div>
            </div>
            <div class="score-divider"></div>
            <div class="score-item total">
              <div class="num">{{ result.score.total }}<span class="den">/{{ scoreTotalMax }}</span></div>
              <div class="label">总分</div>
            </div>
          </div>
          <div class="comment">
            <div class="comment-title">📝 总评 · 评分理由</div>
            <div class="comment-text">{{ result.comment }}</div>
          </div>
          <div v-if="result.critique" class="critique">
            <div class="critique-title">🔍 批评 · 不足与改进</div>
            <div class="critique-text">
              <template v-for="(seg, i) in critiqueSegments" :key="i">
                <span v-if="seg.type === 'normal'">{{ seg.text }}</span>

                <!-- 找到上下文：可悬浮 -->
                <span
                  v-else-if="seg.type === 'quote' && seg.found"
                  class="quote-ref"
                  tabindex="0"
                >“{{ seg.text }}”
                  <span class="quote-tooltip">
                    <span class="qt-label">原文上下文</span>
                    <span class="qt-sentence">
                      <span>{{ seg.sentence.slice(0, seg.hitStart) }}</span><span class="qt-hit">{{ seg.sentence.slice(seg.hitStart, seg.hitEnd) }}</span><span>{{ seg.sentence.slice(seg.hitEnd) }}</span>
                    </span>
                  </span>
                </span>

                <!-- 没找到：仍标记为引用，但提示未在原文匹配 -->
                <span
                  v-else-if="seg.type === 'quote'"
                  class="quote-ref quote-miss"
                  tabindex="0"
                >“{{ seg.text }}”
                  <span class="quote-tooltip">
                    <span class="qt-label">未在原文中找到精确对应</span>
                  </span>
                </span>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- 润色视图（蓝字） -->
      <template v-else-if="viewMode === 'polish'">
        <!-- 还没润色 -->
        <div v-if="!polishResult" class="polish-empty">
          <div class="pe-icon">✨</div>
          <div class="pe-title">尚未润色</div>
          <div class="pe-hint">在批改基础上进一步升级句式 / 词汇 / 衔接，必要时补充内容</div>

          <div class="req-block">
            <label class="req-label">自定义润色要求</label>
            <textarea
              v-model="polishReqVal"
              class="req-textarea"
              rows="3"
              spellcheck="false"
              placeholder="可自定义润色要求，如果留空则由模型自动润色。"
            ></textarea>
          </div>

          <button class="btn-primary" @click="emit('run-polish')">
            开始润色
          </button>
        </div>

        <!-- 已润色 -->
        <template v-else>
          <!-- 润色总结 -->
          <div class="polish-summary">
            <div class="ps-head">
              <div class="ps-title">✨ 润色说明</div>
              <button
                class="ps-toggle"
                @click="reqPanelOpen = !reqPanelOpen"
                :title="reqPanelOpen ? '收起' : '修改自定义要求'"
              >📝 调整要求 {{ reqPanelOpen ? '▲' : '▼' }}</button>
            </div>
            <div class="ps-text">{{ polishResult.summary }}</div>

            <!-- 折叠的自定义要求面板 -->
            <div v-if="reqPanelOpen" class="ps-req-panel">
              <label class="req-label">自定义润色要求</label>
              <textarea
                v-model="polishReqVal"
                class="req-textarea"
                rows="3"
                spellcheck="false"
                placeholder="可自定义润色要求，如果留空则由模型自动润色。"
              ></textarea>
              <div class="ps-req-actions">
                <button class="btn-primary btn-sm" @click="emit('run-polish'); reqPanelOpen = false">
                  按新要求重新润色
                </button>
              </div>
            </div>
          </div>

          <!-- 蓝字 diff -->
          <div class="block flex-grow">
            <label class="lbl">润色结果 · 蓝字标注（基于批改后的版本）</label>
            <div class="diff-view">
              <template v-for="(seg, i) in polishDiff" :key="i">
                <span v-if="seg.op === 0" class="seg-keep">{{ seg.text }}</span>
                <span
                  v-else-if="seg.op === -1"
                  class="seg-del-blue"
                  :title="reasonForPolish(seg)"
                >{{ seg.text }}</span>
                <span
                  v-else-if="seg.op === 1"
                  class="seg-ins-blue"
                  :title="reasonForPolish(seg)"
                >{{ seg.text }}</span>
              </template>
            </div>
          </div>

          <!-- 操作栏 -->
          <div class="action-bar">
            <button class="btn-secondary" @click="emit('run-polish')">↻ 重新润色</button>
            <div class="spacer"></div>
            <span v-if="copyTip" class="copy-tip">{{ copyTip }}</span>
            <button class="btn-secondary" @click="copyPolished">
              📋 复制润色版纯文本
            </button>
          </div>
        </template>
      </template>
    </div>

    <!-- 导出 PDF 用的隐藏离屏容器 -->
    <div class="export-offscreen" aria-hidden="true">
      <div ref="exportRoot">
        <ExportTemplate
          v-if="result"
          :image-url="imageUrl"
          :ocr-text="ocrText"
          :topic="topic"
          :result="result"
          :score-config="scoreConfig"
          :date="todayStr"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  overflow: hidden;
}

/* 顶部步骤 */
.steps {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafbfc;
  font-size: 13px;
  color: #9ca3af;
}
.step.active {
  color: #3b82f6;
  font-weight: 600;
}
.step.done {
  color: #10b981;
}
.arrow {
  color: #d1d5db;
}

/* 错误提示 */
.error-banner {
  padding: 10px 18px;
  background: #fef2f2;
  color: #b91c1c;
  border-bottom: 1px solid #fecaca;
  font-size: 13px;
}

/* 加载 */
.loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #6b7280;
}
.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6b7280;
}
.es-icon { font-size: 56px; }
.es-title { font-size: 16px; font-weight: 600; color: #374151; }
.es-hint { font-size: 13px; margin-bottom: 16px; }

/* 编辑区 */
.edit-area, .result-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
  gap: 14px;
  min-height: 0;
}
.edit-area {
  overflow: hidden;
}
.result-area {
  overflow-y: auto;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.flex-grow { flex: 1; min-height: 0; }
/* 在 result-area 中（可滚动），block.flex-grow 不再抢占剩余空间，
   而是让内容自然撑开，跟随外层一起滚动 */
.result-area .block.flex-grow {
  flex: 0 0 auto;
}
.lbl {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}
.topic-input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
}
.topic-input:focus { border-color: #3b82f6; }
.ocr-textarea {
  flex: 1;
  min-height: 160px;
  padding: 12px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  resize: none;
  font-size: 14px;
  line-height: 1.7;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  background: #fafafa;
}
.ocr-textarea:focus { border-color: #3b82f6; background: #fff; }

/* 涂改预览（仅当 OCR 输出包含 {strike}/{insert}/{erased} 时显示） */
.marks-preview {
  flex: 1;
  min-height: 120px;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  border: 1px solid #fcd34d;
  background: #fffbeb;
  border-radius: 6px;
  padding: 10px 12px;
}
.mp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  flex-shrink: 0;
}
.mp-title {
  font-size: 12px;
  font-weight: 600;
  color: #92400e;
}
.mp-legend {
  display: flex;
  gap: 8px;
  font-size: 11px;
}
.mp-legend .lg-strike {
  color: #6b7280;
  text-decoration: line-through;
  text-decoration-thickness: 2px;
}
.mp-legend .lg-insert {
  color: #15803d;
  background: #dcfce7;
  padding: 0 4px;
  border-radius: 3px;
}
.mp-legend .lg-erased {
  color: #6b7280;
  background: #e5e7eb;
  padding: 0 4px;
  border-radius: 3px;
}
.mp-body {
  flex: 1;
  overflow-y: auto;
  background: #fff;
  border-radius: 4px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.85;
  white-space: pre-wrap;
  word-break: break-word;
}
.mp-normal { color: #1f2937; }
.mp-strike {
  color: #6b7280;
  text-decoration: line-through;
  text-decoration-color: #6b7280;
  text-decoration-thickness: 2px;
}
.mp-insert {
  color: #15803d;
  font-weight: 600;
  background: #dcfce7;
  padding: 0 2px;
  border-radius: 3px;
}
.mp-erased {
  color: #6b7280;
  background: #e5e7eb;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 12px;
  letter-spacing: 1px;
}
.mp-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #92400e;
  line-height: 1.5;
  flex-shrink: 0;
}

/* 按钮 */
.action-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.top-bar {
  margin-bottom: 4px;
  position: sticky;
  top: -16px;       /* 抵消 result-area 的 padding-top，让其贴顶 */
  background: #fff;
  padding: 12px 0 10px;
  margin-top: -16px;
  z-index: 5;
  border-bottom: 1px solid #f1f5f9;
}
.spacer { flex: 1; }
.btn-primary, .btn-secondary {
  padding: 8px 18px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
}
.btn-primary {
  background: #3b82f6;
  color: #fff;
}
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-secondary {
  background: #fff;
  color: #374151;
  border-color: #d1d5db;
}
.btn-secondary:hover { background: #f9fafb; }

.topic-tag {
  font-size: 12px;
  color: #6b7280;
  padding: 4px 10px;
  background: #f3f4f6;
  border-radius: 12px;
}

/* 视图切换 tabs */
.view-tabs {
  display: inline-flex;
  background: #f3f4f6;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.view-tabs .tab {
  padding: 5px 14px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  border-radius: 6px;
  font-weight: 500;
}
.view-tabs .tab:hover { color: #374151; }
.view-tabs .tab.active {
  background: #fff;
  color: #1f2937;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.copy-tip {
  font-size: 12px;
  color: #10b981;
  font-weight: 500;
}

/* Diff 渲染 */
.diff-view {
  padding: 16px 18px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fafafa;
  font-size: 15px;
  line-height: 1.95;
  white-space: pre-wrap;
  word-break: break-word;
}
.seg-keep { color: #1f2937; }

/* 红字（批改） */
.seg-del {
  color: #dc2626;
  text-decoration: line-through;
  text-decoration-color: #dc2626;
  text-decoration-thickness: 2px;
  cursor: help;
}
.seg-ins {
  color: #dc2626;
  font-weight: 600;
  background: #fef2f2;
  padding: 0 2px;
  border-radius: 3px;
  cursor: help;
}
.seg-del:hover, .seg-ins:hover {
  background: #fee2e2;
}

/* 蓝字（润色） */
.seg-del-blue {
  color: #2563eb;
  text-decoration: line-through;
  text-decoration-color: #2563eb;
  text-decoration-thickness: 2px;
  cursor: help;
}
.seg-ins-blue {
  color: #2563eb;
  font-weight: 600;
  background: #eff6ff;
  padding: 0 2px;
  border-radius: 3px;
  cursor: help;
}
.seg-del-blue:hover, .seg-ins-blue:hover {
  background: #dbeafe;
}

/* 分数卡 */
.score-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px 18px;
  background: linear-gradient(135deg, #fafbfc 0%, #f3f4f6 100%);
}
.scores {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-bottom: 12px;
}
.score-item {
  text-align: center;
}
.score-item .num {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
}
.score-item .den {
  font-size: 13px;
  font-weight: 400;
  color: #9ca3af;
  margin-left: 2px;
}
.score-item .label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.score-item.total .num { color: #3b82f6; font-size: 28px; }
.score-divider {
  width: 1px;
  height: 36px;
  background: #d1d5db;
}
.comment {
  border-top: 1px dashed #d1d5db;
  padding-top: 12px;
}
.comment-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}
.comment-text {
  font-size: 13px;
  line-height: 1.7;
  color: #4b5563;
  white-space: pre-wrap;
}

.critique {
  margin-top: 12px;
  border-top: 1px dashed #fcd34d;
  padding-top: 12px;
}
.critique-title {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 6px;
}
.critique-text {
  font-size: 13px;
  line-height: 1.75;
  color: #78350f;
  white-space: pre-wrap;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  padding: 10px 12px;
  border-radius: 4px;
}

/* 批评中的引文：下划虚线 + 悬浮 tooltip
   - 找到原文的英文引用 → 蓝色（突出"可点开看原文"）
   - 找不到 → 维持正文颜色（仅以虚线提示是引用） */
.quote-ref {
  position: relative;
  border-bottom: 1px dashed currentColor;
  cursor: help;
  outline: none;
  color: #2563eb;
}
.quote-ref:hover { color: #1d4ed8; }
.quote-ref.quote-miss {
  color: inherit;
  border-bottom-color: #d6d3d1;
}
.quote-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 30;
  width: max-content;
  max-width: 360px;
  padding: 10px 12px;
  background: #1f2937;
  color: #f9fafb;
  font-size: 12px;
  line-height: 1.65;
  border-radius: 6px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  white-space: normal;
  /* 默认隐藏 */
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: opacity 0.12s, transform 0.12s;
}
/* 小三角 */
.quote-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 16px;
  border: 6px solid transparent;
  border-top-color: #1f2937;
}
.quote-ref:hover .quote-tooltip,
.quote-ref:focus .quote-tooltip,
.quote-ref:focus-within .quote-tooltip {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
.qt-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #fcd34d;
  margin-bottom: 4px;
  letter-spacing: 1px;
}
.qt-sentence {
  display: block;
  color: #e5e7eb;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  word-break: break-word;
}
.qt-hit {
  background: #facc15;
  color: #1f2937;
  padding: 0 2px;
  border-radius: 2px;
  font-weight: 600;
}

/* 离屏导出容器：必须留在 layout 中（让 html2canvas 拿到真实尺寸），
   但移到屏幕外，并避免影响交互 */
.export-offscreen {
  position: fixed;
  left: -99999px;
  top: 0;
  pointer-events: none;
  opacity: 0;
}

/* 润色相关 */
.polish-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #6b7280;
}
.pe-icon { font-size: 56px; }
.pe-title { font-size: 16px; font-weight: 600; color: #374151; }
.pe-hint { font-size: 13px; margin-bottom: 16px; max-width: 320px; text-align: center; }

.polish-summary {
  border: 1px solid #bfdbfe;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-radius: 8px;
  padding: 12px 16px;
}
.ps-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.ps-title {
  font-size: 13px;
  font-weight: 600;
  color: #1e40af;
}
.ps-toggle {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid #bfdbfe;
  color: #1e40af;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  font-weight: 500;
}
.ps-toggle:hover { background: #fff; }
.ps-text {
  font-size: 13px;
  line-height: 1.7;
  color: #1e3a8a;
  white-space: pre-wrap;
}
.ps-req-panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #bfdbfe;
}
.ps-req-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

/* 润色自定义要求文本框（公用） */
.req-block {
  width: 100%;
  max-width: 480px;
  margin-bottom: 16px;
  text-align: left;
}
.req-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 6px;
}
.req-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  resize: vertical;
  font-size: 13px;
  line-height: 1.6;
  font-family: inherit;
  background: #fff;
  transition: border-color 0.15s;
}
.req-textarea:focus { border-color: #3b82f6; }
.req-textarea::placeholder { color: #9ca3af; }

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}
</style>
