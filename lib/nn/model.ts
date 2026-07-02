// ============================================================
// VOIDGPT · Архитектура трансформера
// Каузальный языковой трансформер, посимвольный.
// Multi-head attention + RMSNorm + GELU MLP + Adam.
// ============================================================

import {
  Tensor,
  matmul,
  add,
  addBias,
  scale,
  gelu,
  rmsnorm,
  causalSoftmax,
  transpose,
  sliceCols,
  concatCols,
  embedding,
  crossEntropy,
  softmaxRow,
} from "./tensor"

export interface ModelConfig {
  vocabSize: number
  blockSize: number // длина контекста
  nEmbd: number // размерность эмбеддингов
  nHead: number // число голов внимания
  nLayer: number // число блоков трансформера
}

// ---------- Посимвольный токенизатор ----------
export class CharTokenizer {
  chars: string[]
  stoi: Map<string, number>

  constructor(text: string) {
    const set = new Set<string>(text)
    this.chars = Array.from(set).sort()
    this.stoi = new Map(this.chars.map((c, i) => [c, i]))
  }

  get vocabSize() {
    return this.chars.length
  }

  encode(text: string): number[] {
    const out: number[] = []
    for (const ch of text) {
      const id = this.stoi.get(ch)
      if (id !== undefined) out.push(id)
    }
    return out
  }

  decode(ids: number[]): string {
    return ids.map((i) => this.chars[i] ?? "").join("")
  }

  serialize(): string[] {
    return this.chars
  }

  static deserialize(chars: string[]): CharTokenizer {
    const t = Object.create(CharTokenizer.prototype) as CharTokenizer
    t.chars = chars
    t.stoi = new Map(chars.map((c, i) => [c, i]))
    return t
  }
}

interface LayerParams {
  wq: Tensor
  wk: Tensor
  wv: Tensor
  wo: Tensor
  ln1: Tensor
  ln2: Tensor
  fcW: Tensor
  fcB: Tensor
  projW: Tensor
  projB: Tensor
}

export class VoidGPT {
  config: ModelConfig
  tokEmb: Tensor
  posEmb: Tensor
  layers: LayerParams[]
  lnF: Tensor
  head: Tensor
  params: Tensor[]

  constructor(config: ModelConfig) {
    const { vocabSize: V, blockSize: B, nEmbd: C, nLayer } = config
    this.config = config
    this.tokEmb = Tensor.randn([V, C])
    this.posEmb = Tensor.randn([B, C])
    this.layers = []
    for (let l = 0; l < nLayer; l++) {
      this.layers.push({
        wq: Tensor.randn([C, C]),
        wk: Tensor.randn([C, C]),
        wv: Tensor.randn([C, C]),
        wo: Tensor.randn([C, C], 0.02 / Math.sqrt(2 * nLayer)),
        ln1: Tensor.ones([C]),
        ln2: Tensor.ones([C]),
        fcW: Tensor.randn([C, 4 * C]),
        fcB: Tensor.zeros([4 * C], true),
        projW: Tensor.randn([4 * C, C], 0.02 / Math.sqrt(2 * nLayer)),
        projB: Tensor.zeros([C], true),
      })
    }
    this.lnF = Tensor.ones([C])
    this.head = Tensor.randn([C, V])
    this.params = this.collectParams()
  }

  private collectParams(): Tensor[] {
    const ps: Tensor[] = [this.tokEmb, this.posEmb]
    for (const l of this.layers) {
      ps.push(l.wq, l.wk, l.wv, l.wo, l.ln1, l.ln2, l.fcW, l.fcB, l.projW, l.projB)
    }
    ps.push(this.lnF, this.head)
    return ps
  }

  get paramCount(): number {
    return this.params.reduce((s, p) => s + p.size, 0)
  }

  zeroGrad() {
    for (const p of this.params) p.zeroGrad()
  }

  // Прямой проход: индексы токенов → логиты [T, V]
  forward(idx: number[]): Tensor {
    const { nEmbd: C, nHead } = this.config
    const T = idx.length
    const hs = C / nHead
    const attScale = 1 / Math.sqrt(hs)

    // Токенные + позиционные эмбеддинги
    const tok = embedding(this.tokEmb, idx)
    const pos = embedding(this.posEmb, Array.from({ length: T }, (_, i) => i))
    let x = add(tok, pos)

    for (const L of this.layers) {
      // --- Multi-head causal self-attention ---
      const xn = rmsnorm(x, L.ln1)
      const q = matmul(xn, L.wq)
      const k = matmul(xn, L.wk)
      const v = matmul(xn, L.wv)
      const heads: Tensor[] = []
      for (let h = 0; h < nHead; h++) {
        const qh = sliceCols(q, h * hs, hs)
        const kh = sliceCols(k, h * hs, hs)
        const vh = sliceCols(v, h * hs, hs)
        const scores = scale(matmul(qh, transpose(kh)), attScale)
        const probs = causalSoftmax(scores)
        heads.push(matmul(probs, vh))
      }
      const attOut = matmul(concatCols(heads), L.wo)
      x = add(x, attOut)

      // --- MLP-блок ---
      const xn2 = rmsnorm(x, L.ln2)
      const h1 = gelu(addBias(matmul(xn2, L.fcW), L.fcB))
      const h2 = addBias(matmul(h1, L.projW), L.projB)
      x = add(x, h2)
    }

    const xf = rmsnorm(x, this.lnF)
    return matmul(xf, this.head)
  }

  loss(idx: number[], targets: number[]): Tensor {
    return crossEntropy(this.forward(idx), targets)
  }

  // Сэмплирование следующего токена (top-k + temperature)
  sampleNext(context: number[], temperature: number, topK = 12): number {
    const ctx = context.slice(-this.config.blockSize)
    const logits = this.forward(ctx)
    const probs = softmaxRow(logits, ctx.length - 1, temperature)
    // top-k отбор
    const indexed = Array.from(probs, (p, i) => [p, i] as [number, number])
    indexed.sort((a, b) => b[0] - a[0])
    const top = indexed.slice(0, Math.min(topK, indexed.length))
    const sum = top.reduce((s, [p]) => s + p, 0)
    let r = Math.random() * sum
    for (const [p, i] of top) {
      r -= p
      if (r <= 0) return i
    }
    return top[0][1]
  }

  // ---------- Сериализация ----------
  serialize(): { config: ModelConfig; weights: number[][] } {
    return {
      config: this.config,
      weights: this.params.map((p) => Array.from(p.data)),
    }
  }

  static deserialize(data: { config: ModelConfig; weights: number[][] }): VoidGPT {
    const model = new VoidGPT(data.config)
    model.params.forEach((p, i) => {
      p.data.set(data.weights[i])
    })
    return model
  }
}

// ---------- Adam-оптимизатор ----------
export class Adam {
  lr: number
  beta1 = 0.9
  beta2 = 0.99
  eps = 1e-8
  t = 0
  m: Float32Array[]
  v: Float32Array[]
  params: Tensor[]

  constructor(params: Tensor[], lr = 0.003) {
    this.params = params
    this.lr = lr
    this.m = params.map((p) => new Float32Array(p.size))
    this.v = params.map((p) => new Float32Array(p.size))
  }

  // Клиппинг градиентов по глобальной норме
  clipGrads(maxNorm = 1.0) {
    let total = 0
    for (const p of this.params) {
      if (!p.grad) continue
      for (let i = 0; i < p.size; i++) total += p.grad[i] * p.grad[i]
    }
    const norm = Math.sqrt(total)
    if (norm > maxNorm) {
      const k = maxNorm / (norm + 1e-6)
      for (const p of this.params) {
        if (!p.grad) continue
        for (let i = 0; i < p.size; i++) p.grad[i] *= k
      }
    }
  }

  step() {
    this.t++
    const bc1 = 1 - Math.pow(this.beta1, this.t)
    const bc2 = 1 - Math.pow(this.beta2, this.t)
    for (let pi = 0; pi < this.params.length; pi++) {
      const p = this.params[pi]
      if (!p.grad) continue
      const m = this.m[pi]
      const v = this.v[pi]
      for (let i = 0; i < p.size; i++) {
        const g = p.grad[i]
        m[i] = this.beta1 * m[i] + (1 - this.beta1) * g
        v[i] = this.beta2 * v[i] + (1 - this.beta2) * g * g
        const mh = m[i] / bc1
        const vh = v[i] / bc2
        p.data[i] -= (this.lr * mh) / (Math.sqrt(vh) + this.eps)
      }
    }
  }
}
