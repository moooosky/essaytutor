<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ImageViewer from './components/ImageViewer.vue'
import RightPanel from './components/RightPanel.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { ocrImage, gradeEssay, polishEssay } from './api.js'
import { loadConfig, isConfigComplete } from './config.js'
import { stripMarks } from './utils/marks.js'

const imageUrl = ref('')
const imageFileName = ref('')
const ocrText = ref('')
const topic = ref('')
const result = ref(null)
const polishResult = ref(null)
const polishRequirement = ref('')   // 教师自定义润色要求（每次会话留空）
const viewMode = ref('grade')   // 'grade' | 'polish' —— result 阶段下的子视图

// 响应式的评分配置 —— 设置保存后会刷新，UI 才能跟着重新渲染分母
const scoreConfig = ref(loadConfig().scores)
function refreshConfig() {
  scoreConfig.value = loadConfig().scores
}

// idle | edit | result
const stage = ref('idle')
const loading = ref(false)
const loadingText = ref('')
const errorMsg = ref('')

const settingsOpen = ref(false)

onMounted(() => {
  if (!isConfigComplete(loadConfig())) {
    settingsOpen.value = true
  }
})

function onUpload(payload) {
  // 兼容旧的纯字符串入参
  if (typeof payload === 'string') {
    imageUrl.value = payload
    imageFileName.value = ''
  } else {
    imageUrl.value = payload.dataUrl || ''
    imageFileName.value = payload.fileName || ''
  }
  ocrText.value = ''
  result.value = null
  polishResult.value = null
  polishRequirement.value = ''
  viewMode.value = 'grade'
  stage.value = 'idle'
  errorMsg.value = ''
}

async function runOCR() {
  if (!imageUrl.value) {
    errorMsg.value = '请先上传图片'
    return
  }
  if (!isConfigComplete(loadConfig())) {
    errorMsg.value = '请先在右上角设置中填写 API Key 和接入点 ID'
    settingsOpen.value = true
    return
  }
  errorMsg.value = ''
  loading.value = true
  loadingText.value = '正在识别图片中的英文作文...'
  result.value = null
  polishResult.value = null
  try {
    const text = await ocrImage(imageUrl.value)
    ocrText.value = text
    stage.value = 'edit'
  } catch (e) {
    errorMsg.value = e.message
    stage.value = 'idle'
  } finally {
    loading.value = false
  }
}

async function runGrade() {
  if (!ocrText.value.trim()) {
    errorMsg.value = '作文内容为空'
    return
  }
  errorMsg.value = ''
  loading.value = true
  loadingText.value = '正在批改作文（限定初中范围词汇与语法）...'
  // 重新批改时清空旧的润色结果与自定义要求
  polishResult.value = null
  polishRequirement.value = ''
  viewMode.value = 'grade'

  // 把涂改标记清理掉再送给批改 API：
  //   {strike:xxx} → 删除（学生已否定）
  //   {insert:xxx} → 保留 xxx（学生最终表达）
  //   {erased}     → [?]（让模型当成"看不清"）
  // 同时把清理后的文本写回 ocrText —— 这样后续的"红字 diff"基于的也是
  // 学生最终版本，避免标记残留进 diff 计算。
  const cleaned = stripMarks(ocrText.value)
  if (cleaned !== ocrText.value) {
    ocrText.value = cleaned
  }

  try {
    const res = await gradeEssay(cleaned, topic.value)
    result.value = res
    stage.value = 'result'
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    loading.value = false
  }
}

async function runPolish() {
  if (!result.value?.polished) {
    errorMsg.value = '请先完成批改'
    return
  }
  errorMsg.value = ''
  loading.value = true
  loadingText.value = '正在润色作文（升级句式 / 词汇 / 衔接）...'
  try {
    const res = await polishEssay(result.value.polished, topic.value, polishRequirement.value)
    polishResult.value = res
    viewMode.value = 'polish'
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    loading.value = false
  }
}

function resetGrade() {
  result.value = null
  polishResult.value = null
  polishRequirement.value = ''
  viewMode.value = 'grade'
  stage.value = 'edit'
  errorMsg.value = ''
}

function switchView(mode) {
  viewMode.value = mode
  errorMsg.value = ''
}

// ────────── 左右分栏拖动 ──────────
const SPLIT_KEY = 'essay-grader-split-ratio'
const MIN_RATIO = 0.2
const MAX_RATIO = 0.8

const leftRatio = ref(loadRatio())
const mainRef = ref(null)
const isDragging = ref(false)

function loadRatio() {
  const v = parseFloat(localStorage.getItem(SPLIT_KEY))
  if (Number.isFinite(v) && v >= MIN_RATIO && v <= MAX_RATIO) return v
  return 0.5
}

function onSplitterMouseDown(e) {
  e.preventDefault()
  isDragging.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!isDragging.value || !mainRef.value) return
  const rect = mainRef.value.getBoundingClientRect()
  let ratio = (e.clientX - rect.left) / rect.width
  if (ratio < MIN_RATIO) ratio = MIN_RATIO
  if (ratio > MAX_RATIO) ratio = MAX_RATIO
  leftRatio.value = ratio
}

function onMouseUp() {
  if (!isDragging.value) return
  isDragging.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  localStorage.setItem(SPLIT_KEY, String(leftRatio.value))
}

function onSplitterDblClick() {
  // 双击复位到 50%
  leftRatio.value = 0.5
  localStorage.setItem(SPLIT_KEY, '0.5')
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})
</script>

<template>
  <div class="app">
    <!-- 顶部栏 -->
    <header class="topbar">
      <div class="title">
        <img class="logo-img" src="/avatar.jpg" alt="头像" />
        <span>雅君的作文助教</span>
        <span class="subtitle">手写图片 · 智能识别</span>
      </div>
      <div class="actions">
        <button class="icon-btn" @click="settingsOpen = true" title="设置">
          ⚙ 设置
        </button>
      </div>
    </header>

    <!-- 主内容：左右分栏 -->
    <main class="main" ref="mainRef" :class="{ dragging: isDragging }">
      <div class="pane pane-left" :style="{ flexBasis: (leftRatio * 100) + '%' }">
        <ImageViewer :image-url="imageUrl" @upload="onUpload" />
      </div>
      <div
        class="splitter"
        :class="{ active: isDragging }"
        @mousedown="onSplitterMouseDown"
        @dblclick="onSplitterDblClick"
        title="拖动调整宽度，双击复位"
      >
        <div class="splitter-handle"></div>
      </div>
      <div class="pane pane-right" :style="{ flexBasis: ((1 - leftRatio) * 100) + '%' }">
        <RightPanel
          :stage="stage"
          v-model:ocr-text="ocrText"
          v-model:topic="topic"
          v-model:polish-requirement="polishRequirement"
          :result="result"
          :polish-result="polishResult"
          :view-mode="viewMode"
          :loading="loading"
          :loading-text="loadingText"
          :error-msg="errorMsg"
          :has-image="!!imageUrl"
          :image-url="imageUrl"
          :image-file-name="imageFileName"
          :score-config="scoreConfig"
          @run-ocr="runOCR"
          @run-grade="runGrade"
          @run-polish="runPolish"
          @switch-view="switchView"
          @reset="resetGrade"
        />
      </div>
    </main>

    <SettingsDialog v-model="settingsOpen" @saved="refreshConfig" />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.topbar {
  display: flex;
  align-items: center;
  padding: 12px 22px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
  z-index: 10;
}
.title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 22px;
  font-weight: 600;
  color: #111827;
}
.title .logo { font-size: 20px; }
.title .logo-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  align-self: center;
  border: 1px solid #e5e7eb;
}
.subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #9ca3af;
  margin-left: 6px;
}
.actions {
  margin-left: auto;
}
.icon-btn {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
}
.icon-btn:hover {
  background: #f9fafb;
}

.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.main.dragging {
  cursor: col-resize;
}
.pane {
  flex: 0 0 50%;       /* 默认 50/50，被 :style 覆盖 */
  min-width: 0;
  overflow: hidden;
}

/* 拖动条 */
.splitter {
  flex: 0 0 6px;
  position: relative;
  background: #e5e7eb;
  cursor: col-resize;
  transition: background 0.15s;
  user-select: none;
}
.splitter:hover,
.splitter.active {
  background: #3b82f6;
}
/* 拖动条中间的小手柄，提升可发现性 */
.splitter-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 36px;
  background: #cbd5e1;
  border-radius: 2px;
  transition: background 0.15s, height 0.15s;
}
.splitter:hover .splitter-handle,
.splitter.active .splitter-handle {
  background: #fff;
  height: 48px;
}
</style>
