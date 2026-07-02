// ============================================================
// VOIDGPT · Тензорный autograd-движок
// Написан вручную, с нуля. Ноль ML-библиотек.
// Автор архитектуры: ты. Реализация: L1TVOID.
// ============================================================

export class Tensor {
  data: Float32Array
  grad: Float32Array | null = null
  shape: number[]
  requiresGrad: boolean
  _backward: () => void = () => {}
  _prev: Tensor[] = []

  constructor(data: Float32Array, shape: number[], requiresGrad = false) {
    this.data = data
    this.shape = shape
    this.requiresGrad = requiresGrad
  }

  get size(): number {
    return this.shape.reduce((a, b) => a * b, 1)
  }

  static zeros(shape: number[], requiresGrad = false): Tensor {
    const size = shape.reduce((a, b) => a * b, 1)
    return new Tensor(new Float32Array(size), shape, requiresGrad)
  }

  // Инициализация нормальным распределением (Box–Muller)
  static randn(shape: number[], std = 0.02, requiresGrad = true): Tensor {
    const size = shape.reduce((a, b) => a * b, 1)
    const data = new Float32Array(size)
    for (let i = 0; i < size; i += 2) {
      const u1 = Math.random() || 1e-9
      const u2 = Math.random()
      const r = Math.sqrt(-2 * Math.log(u1))
      data[i] = r * Math.cos(2 * Math.PI * u2) * std
      if (i + 1 < size) data[i + 1] = r * Math.sin(2 * Math.PI * u2) * std
    }
    return new Tensor(data, shape, requiresGrad)
  }

  static ones(shape: number[], requiresGrad = true): Tensor {
    const size = shape.reduce((a, b) => a * b, 1)
    const data = new Float32Array(size).fill(1)
    return new Tensor(data, shape, requiresGrad)
  }

  ensureGrad(): Float32Array {
    if (!this.grad) this.grad = new Float32Array(this.size)
    return this.grad
  }

  zeroGrad() {
    if (this.grad) this.grad.fill(0)
  }

  // Обратное распространение: топологическая сортировка графа,
  // затем проход в обратном порядке.
  backward() {
    const topo: Tensor[] = []
    const visited = new Set<Tensor>()
    const stack: Array<[Tensor, boolean]> = [[this, false]]
    while (stack.length) {
      const [node, processed] = stack.pop()!
      if (processed) {
        topo.push(node)
        continue
      }
      if (visited.has(node)) continue
      visited.add(node)
      stack.push([node, true])
      for (const p of node._prev) if (!visited.has(p)) stack.push([p, false])
    }
    this.ensureGrad().fill(1)
    for (let i = topo.length - 1; i >= 0; i--) topo[i]._backward()
  }
}

function needsGrad(...ts: Tensor[]): boolean {
  return ts.some((t) => t.requiresGrad)
}

// ---------- Матричное умножение: C[m,n] = A[m,k] · B[k,n] ----------
export function matmul(a: Tensor, b: Tensor): Tensor {
  const [m, k] = a.shape
  const n = b.shape[1]
  const out = Tensor.zeros([m, n], needsGrad(a, b))
  const A = a.data
  const B = b.data
  const C = out.data
  for (let i = 0; i < m; i++) {
    const ao = i * k
    const co = i * n
    for (let p = 0; p < k; p++) {
      const av = A[ao + p]
      if (av === 0) continue
      const bo = p * n
      for (let j = 0; j < n; j++) C[co + j] += av * B[bo + j]
    }
  }
  out._prev = [a, b]
  out._backward = () => {
    const dC = out.grad!
    if (a.requiresGrad) {
      const dA = a.ensureGrad()
      for (let i = 0; i < m; i++) {
        const co = i * n
        const ao = i * k
        for (let p = 0; p < k; p++) {
          let s = 0
          const bo = p * n
          for (let j = 0; j < n; j++) s += dC[co + j] * B[bo + j]
          dA[ao + p] += s
        }
      }
    }
    if (b.requiresGrad) {
      const dB = b.ensureGrad()
      for (let i = 0; i < m; i++) {
        const ao = i * k
        const co = i * n
        for (let p = 0; p < k; p++) {
          const av = A[ao + p]
          if (av === 0) continue
          const bo = p * n
          for (let j = 0; j < n; j++) dB[bo + j] += av * dC[co + j]
        }
      }
    }
  }
  return out
}

// ---------- Поэлементное сложение (одинаковые формы) ----------
export function add(a: Tensor, b: Tensor): Tensor {
  const out = Tensor.zeros(a.shape, needsGrad(a, b))
  for (let i = 0; i < a.size; i++) out.data[i] = a.data[i] + b.data[i]
  out._prev = [a, b]
  out._backward = () => {
    const dO = out.grad!
    if (a.requiresGrad) {
      const dA = a.ensureGrad()
      for (let i = 0; i < a.size; i++) dA[i] += dO[i]
    }
    if (b.requiresGrad) {
      const dB = b.ensureGrad()
      for (let i = 0; i < b.size; i++) dB[i] += dO[i]
    }
  }
  return out
}

// ---------- Добавление bias-вектора к каждой строке ----------
export function addBias(a: Tensor, bias: Tensor): Tensor {
  const [m, n] = a.shape
  const out = Tensor.zeros([m, n], needsGrad(a, bias))
  for (let i = 0; i < m; i++) {
    const o = i * n
    for (let j = 0; j < n; j++) out.data[o + j] = a.data[o + j] + bias.data[j]
  }
  out._prev = [a, bias]
  out._backward = () => {
    const dO = out.grad!
    if (a.requiresGrad) {
      const dA = a.ensureGrad()
      for (let i = 0; i < a.size; i++) dA[i] += dO[i]
    }
    if (bias.requiresGrad) {
      const dB = bias.ensureGrad()
      for (let i = 0; i < m; i++) {
        const o = i * n
        for (let j = 0; j < n; j++) dB[j] += dO[o + j]
      }
    }
  }
  return out
}

// ---------- Умножение на скаляр ----------
export function scale(a: Tensor, s: number): Tensor {
  const out = Tensor.zeros(a.shape, a.requiresGrad)
  for (let i = 0; i < a.size; i++) out.data[i] = a.data[i] * s
  out._prev = [a]
  out._backward = () => {
    if (!a.requiresGrad) return
    const dA = a.ensureGrad()
    const dO = out.grad!
    for (let i = 0; i < a.size; i++) dA[i] += dO[i] * s
  }
  return out
}

// ---------- GELU-активация (tanh-аппроксимация) ----------
const GELU_C = Math.sqrt(2 / Math.PI)
export function gelu(a: Tensor): Tensor {
  const out = Tensor.zeros(a.shape, a.requiresGrad)
  const X = a.data
  for (let i = 0; i < a.size; i++) {
    const x = X[i]
    const t = Math.tanh(GELU_C * (x + 0.044715 * x * x * x))
    out.data[i] = 0.5 * x * (1 + t)
  }
  out._prev = [a]
  out._backward = () => {
    if (!a.requiresGrad) return
    const dA = a.ensureGrad()
    const dO = out.grad!
    for (let i = 0; i < a.size; i++) {
      const x = X[i]
      const u = GELU_C * (x + 0.044715 * x * x * x)
      const t = Math.tanh(u)
      const du = GELU_C * (1 + 3 * 0.044715 * x * x)
      const dydx = 0.5 * (1 + t) + 0.5 * x * (1 - t * t) * du
      dA[i] += dO[i] * dydx
    }
  }
  return out
}

// ---------- RMSNorm: y = x / rms(x) * w ----------
export function rmsnorm(a: Tensor, w: Tensor): Tensor {
  const [m, n] = a.shape
  const out = Tensor.zeros([m, n], needsGrad(a, w))
  const rms = new Float32Array(m)
  for (let i = 0; i < m; i++) {
    const o = i * n
    let ss = 0
    for (let j = 0; j < n; j++) ss += a.data[o + j] * a.data[o + j]
    const r = Math.sqrt(ss / n + 1e-5)
    rms[i] = r
    for (let j = 0; j < n; j++) out.data[o + j] = (a.data[o + j] / r) * w.data[j]
  }
  out._prev = [a, w]
  out._backward = () => {
    const dO = out.grad!
    for (let i = 0; i < m; i++) {
      const o = i * n
      const r = rms[i]
      if (w.requiresGrad) {
        const dW = w.ensureGrad()
        for (let j = 0; j < n; j++) dW[j] += dO[o + j] * (a.data[o + j] / r)
      }
      if (a.requiresGrad) {
        const dA = a.ensureGrad()
        // g = dO * w; dx = (g - x̂ * mean(g·x̂)) / r
        let dot = 0
        for (let j = 0; j < n; j++) {
          const g = dO[o + j] * w.data[j]
          dot += g * (a.data[o + j] / r)
        }
        const mean = dot / n
        for (let j = 0; j < n; j++) {
          const g = dO[o + j] * w.data[j]
          dA[o + j] += (g - (a.data[o + j] / r) * mean) / r
        }
      }
    }
  }
  return out
}

// ---------- Каузальный softmax по строкам [T,T] ----------
// Позиция i видит только позиции j <= i (маска будущего).
export function causalSoftmax(scores: Tensor): Tensor {
  const [T] = scores.shape
  const out = Tensor.zeros([T, T], scores.requiresGrad)
  for (let i = 0; i < T; i++) {
    const o = i * T
    let max = Number.NEGATIVE_INFINITY
    for (let j = 0; j <= i; j++) if (scores.data[o + j] > max) max = scores.data[o + j]
    let sum = 0
    for (let j = 0; j <= i; j++) {
      const e = Math.exp(scores.data[o + j] - max)
      out.data[o + j] = e
      sum += e
    }
    for (let j = 0; j <= i; j++) out.data[o + j] /= sum
    // j > i остаются нулями — будущее скрыто
  }
  out._prev = [scores]
  out._backward = () => {
    if (!scores.requiresGrad) return
    const dS = scores.ensureGrad()
    const dP = out.grad!
    const P = out.data
    for (let i = 0; i < T; i++) {
      const o = i * T
      let dot = 0
      for (let j = 0; j <= i; j++) dot += dP[o + j] * P[o + j]
      for (let j = 0; j <= i; j++) dS[o + j] += P[o + j] * (dP[o + j] - dot)
    }
  }
  return out
}

// ---------- Транспонирование 2D ----------
export function transpose(a: Tensor): Tensor {
  const [m, n] = a.shape
  const out = Tensor.zeros([n, m], a.requiresGrad)
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) out.data[j * m + i] = a.data[i * n + j]
  out._prev = [a]
  out._backward = () => {
    if (!a.requiresGrad) return
    const dA = a.ensureGrad()
    const dO = out.grad!
    for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) dA[i * n + j] += dO[j * m + i]
  }
  return out
}

// ---------- Срез колонок [m, width] из [m, n] ----------
export function sliceCols(a: Tensor, start: number, width: number): Tensor {
  const [m, n] = a.shape
  const out = Tensor.zeros([m, width], a.requiresGrad)
  for (let i = 0; i < m; i++) {
    const ao = i * n + start
    const oo = i * width
    for (let j = 0; j < width; j++) out.data[oo + j] = a.data[ao + j]
  }
  out._prev = [a]
  out._backward = () => {
    if (!a.requiresGrad) return
    const dA = a.ensureGrad()
    const dO = out.grad!
    for (let i = 0; i < m; i++) {
      const ao = i * n + start
      const oo = i * width
      for (let j = 0; j < width; j++) dA[ao + j] += dO[oo + j]
    }
  }
  return out
}

// ---------- Конкатенация по колонкам ----------
export function concatCols(parts: Tensor[]): Tensor {
  const m = parts[0].shape[0]
  const n = parts.reduce((s, p) => s + p.shape[1], 0)
  const out = Tensor.zeros([m, n], parts.some((p) => p.requiresGrad))
  let off = 0
  for (const p of parts) {
    const w = p.shape[1]
    for (let i = 0; i < m; i++) {
      const po = i * w
      const oo = i * n + off
      for (let j = 0; j < w; j++) out.data[oo + j] = p.data[po + j]
    }
    off += w
  }
  out._prev = parts.slice()
  out._backward = () => {
    const dO = out.grad!
    let o2 = 0
    for (const p of parts) {
      const w = p.shape[1]
      if (p.requiresGrad) {
        const dP = p.ensureGrad()
        for (let i = 0; i < m; i++) {
          const po = i * w
          const oo = i * n + o2
          for (let j = 0; j < w; j++) dP[po + j] += dO[oo + j]
        }
      }
      o2 += w
    }
  }
  return out
}

// ---------- Embedding: выборка строк weight[V,C] по индексам ----------
export function embedding(weight: Tensor, indices: number[]): Tensor {
  const C = weight.shape[1]
  const T = indices.length
  const out = Tensor.zeros([T, C], weight.requiresGrad)
  for (let t = 0; t < T; t++) {
    const wo = indices[t] * C
    const oo = t * C
    for (let j = 0; j < C; j++) out.data[oo + j] = weight.data[wo + j]
  }
  out._prev = [weight]
  out._backward = () => {
    if (!weight.requiresGrad) return
    const dW = weight.ensureGrad()
    const dO = out.grad!
    for (let t = 0; t < T; t++) {
      const wo = indices[t] * C
      const oo = t * C
      for (let j = 0; j < C; j++) dW[wo + j] += dO[oo + j]
    }
  }
  return out
}

// ---------- Cross-Entropy loss (fused softmax + NLL) ----------
export function crossEntropy(logits: Tensor, targets: number[]): Tensor {
  const [T, V] = logits.shape
  const probs = new Float32Array(T * V)
  let loss = 0
  for (let t = 0; t < T; t++) {
    const o = t * V
    let max = Number.NEGATIVE_INFINITY
    for (let j = 0; j < V; j++) if (logits.data[o + j] > max) max = logits.data[o + j]
    let sum = 0
    for (let j = 0; j < V; j++) {
      const e = Math.exp(logits.data[o + j] - max)
      probs[o + j] = e
      sum += e
    }
    for (let j = 0; j < V; j++) probs[o + j] /= sum
    loss += -Math.log(probs[o + targets[t]] + 1e-9)
  }
  loss /= T
  const out = new Tensor(new Float32Array([loss]), [1], logits.requiresGrad)
  out._prev = [logits]
  out._backward = () => {
    if (!logits.requiresGrad) return
    const dL = logits.ensureGrad()
    const g = out.grad![0]
    for (let t = 0; t < T; t++) {
      const o = t * V
      for (let j = 0; j < V; j++) {
        dL[o + j] += ((probs[o + j] - (j === targets[t] ? 1 : 0)) / T) * g
      }
    }
  }
  return out
}

// ---------- Softmax последней строки логитов (для генерации) ----------
export function softmaxRow(logits: Tensor, row: number, temperature: number): Float32Array {
  const V = logits.shape[1]
  const o = row * V
  const out = new Float32Array(V)
  const temp = Math.max(temperature, 0.05)
  let max = Number.NEGATIVE_INFINITY
  for (let j = 0; j < V; j++) {
    const v = logits.data[o + j] / temp
    out[j] = v
    if (v > max) max = v
  }
  let sum = 0
  for (let j = 0; j < V; j++) {
    out[j] = Math.exp(out[j] - max)
    sum += out[j]
  }
  for (let j = 0; j < V; j++) out[j] /= sum
  return out
}
