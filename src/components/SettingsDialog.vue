<script setup>
import { ref, computed } from 'vue'
import { saveConfig, loadConfig, getTotalMax } from '../config.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'saved'])

const cfg = ref(loadConfig())

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const totalMax = computed(() => getTotalMax(cfg.value))

function onSave() {
  // 校验分数
  const s = cfg.value.scores
  if (!Number.isFinite(+s.content) || +s.content < 0 ||
      !Number.isFinite(+s.grammar) || +s.grammar < 0 ||
      !Number.isFinite(+s.style)   || +s.style < 0) {
    alert('各项分数必须为非负数字')
    return
  }
  cfg.value.scores = {
    content: Number(s.content),
    grammar: Number(s.grammar),
    style: Number(s.style)
  }
  if (totalMax.value <= 0) {
    alert('总分必须大于 0')
    return
  }
  saveConfig(cfg.value)
  emit('saved')
  visible.value = false
}

function onCancel() {
  cfg.value = loadConfig()
  visible.value = false
}
</script>

<template>
  <div v-if="visible" class="mask" @click.self="onCancel">
    <div class="dialog">
      <h3>设置</h3>
      <div class="hint">
        所有信息保存在浏览器本地（localStorage），不会上传到任何服务器。
      </div>

      <div class="section-title">火山方舟接入</div>

      <label>API Key</label>
      <input
        v-model="cfg.apiKey"
        type="password"
        placeholder="ark-xxxxxxxxxxxxxxxxxxxx"
        autocomplete="off"
      />

      <label>视觉模型接入点 ID（OCR 用，如 Doubao-vision）</label>
      <input
        v-model="cfg.visionEndpoint"
        type="text"
        placeholder="ep-2025xxxxxxxx-xxxxx"
        autocomplete="off"
      />

      <label>批改模型接入点 ID（如 DeepSeek-V3.1）</label>
      <input
        v-model="cfg.graderEndpoint"
        type="text"
        placeholder="ep-2025xxxxxxxx-xxxxx"
        autocomplete="off"
      />

      <label>Base URL（一般无需修改）</label>
      <input v-model="cfg.baseUrl" type="text" autocomplete="off" />

      <div class="section-title">评分体系</div>
      <div class="score-grid">
        <div class="score-field">
          <label>内容分（最高）</label>
          <input v-model.number="cfg.scores.content" type="number" min="0" step="0.5" />
        </div>
        <div class="score-field">
          <label>语法分（最高）</label>
          <input v-model.number="cfg.scores.grammar" type="number" min="0" step="0.5" />
        </div>
        <div class="score-field">
          <label>文采分（最高）</label>
          <input v-model.number="cfg.scores.style" type="number" min="0" step="0.5" />
        </div>
      </div>
      <div class="total-hint">
        当前总分：<b>{{ totalMax }}</b> 分
        <span class="muted">（默认 10 分：内容 4 + 语法 4 + 文采 2）</span>
      </div>

      <div class="actions">
        <button class="secondary" @click="onCancel">取消</button>
        <button class="primary" @click="onSave">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 28px 32px;
  width: 540px;
  max-width: 92vw;
  max-height: 92vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}
.dialog h3 {
  margin-bottom: 8px;
  color: #111827;
}
.hint {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 14px;
}
.section-title {
  margin-top: 18px;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}
label {
  display: block;
  margin-top: 12px;
  margin-bottom: 6px;
  font-size: 13px;
  color: #374151;
  font-weight: 500;
}
input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s;
}
input:focus {
  border-color: #3b82f6;
}
.score-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
  margin-top: 4px;
}
.score-field label {
  margin-top: 8px;
  font-size: 12px;
  color: #4b5563;
}
.total-hint {
  margin-top: 10px;
  font-size: 13px;
  color: #1f2937;
}
.total-hint b {
  color: #3b82f6;
  font-size: 16px;
  margin: 0 2px;
}
.total-hint .muted {
  color: #9ca3af;
  font-size: 12px;
  margin-left: 6px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
}
button {
  padding: 8px 18px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-size: 14px;
}
button.primary {
  background: #3b82f6;
  color: #fff;
}
button.primary:hover {
  background: #2563eb;
}
button.secondary {
  background: #fff;
  color: #374151;
  border-color: #d1d5db;
}
button.secondary:hover {
  background: #f9fafb;
}
</style>
