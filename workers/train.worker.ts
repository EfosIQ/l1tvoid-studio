// ============================================================
// VOIDGPT · Тренировочный воркер
// Обучение и генерация в фоновом потоке — UI не блокируется.
// ============================================================

import { VoidGPT, Adam, CharTokenizer, type ModelConfig } from "../lib/nn/model"

let model: VoidGPT | null = null
let tokenizer: CharTokenizer | null = null
let optimizer: Adam | null = null
let dataIds: number[] = []
let running = false
let stepCount = 0
let emaLoss: number | null = null
let generating = false
let stopGen = false

type InMsg =
  | { type: "init"; corpus: string; config: Omit<ModelConfig, "vocabSize"> ; lr: number }
  | { type: "start" }
  | { type: "pause" }
  | { type: "generate"; prompt: string; length: number; temperature: number }
  | { type: "stopGenerate" }
  | { type: "export" }
  | { type: "import"; payload: { config: ModelConfig; weights: number[][]; vocab: string[]; step: number } }

function post(msg: unknown) {
  ;(self as unknown as Worker).postMessage(msg)
}

function sampleBatch(blockSize: number): { x: number[]; y: number[] } | null {
  if (dataIds.length < blockSize + 2) return null
  const start = Math.floor(Math.random() * (dataIds.length - blockSize - 1))
  return {
    x: dataIds.slice(start, start + blockSize),
    y: dataIds.slice(start + 1, start + blockSize + 1),
  }
}

function trainChunk() {
  if (!running || !model || !optimizer) return
  const t0 = performance.now()
  let steps = 0
  let lastLoss = 0
  // Работаем ~80мс, затем отдаём поток событий (сообщения pause и т.п.)
  while (performance.now() - t0 < 80) {
    const batch = sampleBatch(model.config.blockSize)
    if (!batch) {
      running = false
      post({ type: "error", message: "Корпус слишком мал для выбранного контекста" })
      return
    }
    model.zeroGrad()
    const loss = model.loss(batch.x, batch.y)
    loss.backward()
    optimizer.clipGrads(1.0)
    optimizer.step()
    lastLoss = loss.data[0]
    emaLoss = emaLoss === null ? lastLoss : emaLoss * 0.95 + lastLoss * 0.05
    stepCount++
    steps++
  }
  const dt = (performance.now() - t0) / 1000
  post({
    type: "progress",
    step: stepCount,
    loss: lastLoss,
    emaLoss,
    stepsPerSec: steps / dt,
  })
  setTimeout(trainChunk, 0)
}

async function generate(prompt: string, length: number, temperature: number) {
  if (!model || !tokenizer) return
  generating = true
  stopGen = false
  let context = tokenizer.encode(prompt)
  if (context.length === 0) {
    // Пустой промпт — стартуем со случайного символа корпуса
    context = [dataIds[Math.floor(Math.random() * dataIds.length)] ?? 0]
  }
  for (let i = 0; i < length; i++) {
    if (stopGen) break
    const next = model.sampleNext(context, temperature)
    context.push(next)
    post({ type: "token", char: tokenizer.decode([next]) })
    // Отдаём поток, чтобы принять stopGenerate
    await new Promise((r) => setTimeout(r, 0))
  }
  generating = false
  post({ type: "genDone" })
}

self.onmessage = (e: MessageEvent<InMsg>) => {
  const msg = e.data
  switch (msg.type) {
    case "init": {
      running = false
      stepCount = 0
      emaLoss = null
      tokenizer = new CharTokenizer(msg.corpus)
      dataIds = tokenizer.encode(msg.corpus)
      const config: ModelConfig = { ...msg.config, vocabSize: tokenizer.vocabSize }
      model = new VoidGPT(config)
      optimizer = new Adam(model.params, msg.lr)
      post({
        type: "ready",
        vocabSize: tokenizer.vocabSize,
        paramCount: model.paramCount,
        corpusLength: dataIds.length,
      })
      break
    }
    case "start": {
      if (!model) return
      if (!running) {
        running = true
        setTimeout(trainChunk, 0)
      }
      break
    }
    case "pause": {
      running = false
      post({ type: "paused", step: stepCount })
      break
    }
    case "generate": {
      if (generating) return
      running = false
      void generate(msg.prompt, msg.length, msg.temperature)
      break
    }
    case "stopGenerate": {
      stopGen = true
      break
    }
    case "export": {
      if (!model || !tokenizer) return
      post({
        type: "exported",
        payload: {
          ...model.serialize(),
          vocab: tokenizer.serialize(),
          step: stepCount,
        },
      })
      break
    }
    case "import": {
      running = false
      tokenizer = CharTokenizer.deserialize(msg.payload.vocab)
      model = VoidGPT.deserialize(msg.payload)
      optimizer = new Adam(model.params)
      stepCount = msg.payload.step
      emaLoss = null
      post({
        type: "ready",
        vocabSize: tokenizer.vocabSize,
        paramCount: model.paramCount,
        corpusLength: dataIds.length,
        restoredStep: msg.payload.step,
      })
      break
    }
  }
}
