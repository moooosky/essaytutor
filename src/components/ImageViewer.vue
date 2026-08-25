<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  imageUrl: { type: String, default: '' }
})
const emit = defineEmits(['upload'])

const fileInput = ref(null)
const scale = ref(1)
const offsetX = ref(0)
const offsetY = ref(0)
const dragging = ref(false)
let lastX = 0, lastY = 0

const transformStyle = computed(() => ({
  transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
  transformOrigin: 'center center'
}))

function onPick() {
  fileInput.value?.click()
}

function onFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    emit('upload', { dataUrl: reader.result, fileName: file.name })
    resetTransform()
  }
  reader.readAsDataURL(file)
  e.target.value = ''
}

function resetTransform() {
  scale.value = 1
  offsetX.value = 0
  offsetY.value = 0
}

function onWheel(e) {
  if (!props.imageUrl) return
  e.preventDefault()
  const delta = e.deltaY < 0 ? 0.1 : -0.1
  scale.value = Math.max(0.2, Math.min(5, scale.value + delta))
}

function onMouseDown(e) {
  if (!props.imageUrl) return
  dragging.value = true
  lastX = e.clientX
  lastY = e.clientY
}

function onMouseMove(e) {
  if (!dragging.value) return
  offsetX.value += e.clientX - lastX
  offsetY.value += e.clientY - lastY
  lastX = e.clientX
  lastY = e.clientY
}

function onMouseUp() {
  dragging.value = false
}

function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      const reader = new FileReader()
      reader.onload = () => {
        // 粘贴的图片可能没有正经文件名，给一个时间戳兜底
        const fileName = file.name && file.name !== 'image.png'
          ? file.name
          : `pasted_${Date.now()}.png`
        emit('upload', { dataUrl: reader.result, fileName })
        resetTransform()
      }
      reader.readAsDataURL(file)
      break
    }
  }
}
</script>

<template>
  <div class="image-viewer" @paste="onPaste" tabindex="0">
    <div class="toolbar">
      <button @click="onPick" class="btn-primary">📷 上传图片</button>
      <span v-if="imageUrl" class="hint">滚轮缩放 · 拖动平移 · Ctrl+V 粘贴</span>
      <span v-else class="hint">点击上传，或在此区域 Ctrl+V 粘贴图片</span>
      <div class="spacer"></div>
      <template v-if="imageUrl">
        <button @click="scale = Math.min(5, scale + 0.2)" title="放大">+</button>
        <button @click="scale = Math.max(0.2, scale - 0.2)" title="缩小">−</button>
        <button @click="resetTransform" title="复位">⟲</button>
      </template>
    </div>

    <div
      class="canvas"
      :class="{ dragging }"
      @wheel="onWheel"
      @mousedown="onMouseDown"
      @mousemove="onMouseMove"
      @mouseup="onMouseUp"
      @mouseleave="onMouseUp"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :style="transformStyle"
        alt="作文图片"
        draggable="false"
      />
      <div v-else class="placeholder">
        <div class="ph-icon">📄</div>
        <div>请上传或粘贴学生作文图片</div>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change="onFileChange"
    />
  </div>
</template>

<style scoped>
.image-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  outline: none;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafbfc;
}
.spacer { flex: 1; }
.toolbar button {
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 6px;
  font-size: 13px;
}
.toolbar button:hover { background: #f3f4f6; }
.toolbar button.btn-primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
.toolbar button.btn-primary:hover { background: #2563eb; }
.hint {
  font-size: 12px;
  color: #6b7280;
}
.canvas {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}
.canvas.dragging { cursor: grabbing; }
.canvas img {
  max-width: 100%;
  max-height: 100%;
  user-select: none;
  transition: transform 0.05s linear;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}
.placeholder {
  text-align: center;
  color: #9ca3af;
}
.ph-icon {
  font-size: 64px;
  margin-bottom: 12px;
}
</style>
