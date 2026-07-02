"use client"

// Хук-мост между UI и тренировочным воркером VoidGPT.

import { useCallback, useEffect, useRef, useState } from "react"

export interface NetConfig {
  blockSize: number
  nEmbd: number
  nHead: number
  nLayer: number
}

export type Status = "idle" | "building" | "ready" | "training" | "paused" | "generating"

export interface VoidGPTState {
  status: Status
  step: number
  loss: number | null
  emaLoss: number | null
  stepsPerSec: number
  lossHistory: number[]
  vocabSize: number
  paramCount: number
  corpusLength: number
  output: string
  error: string | null
}

const INITIAL: VoidGPTState = {
  status: "idle",
  step: 0,
  loss: null,
  emaLoss: null,
  stepsPerSec: 0,
  lossHistory: [],
  vocabSize: 0,
  paramCount: 0,
  corpusLength: 0,
  output: "",
  error: null,
}

export function useVoidGPT() {
  const workerRef = useRef<Worker | null>(null)
  const [state, setState] = useState<VoidGPTState>(INITIAL)

  useEffect(() => {
    const worker = new Worker(new URL("../workers/train.worker.ts", import.meta.url))
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      switch (msg.type) {
        case "ready":
          setState((s) => ({
            ...s,
            status: "ready",
            vocabSize: msg.vocabSize,
            paramCount: msg.paramCount,
            corpusLength: msg.corpusLength,
            step: msg.restoredStep ?? 0,
            loss: null,
            emaLoss: null,
            lossHistory: [],
            output: "",
            error: null,
          }))
          break
        case "progress":
          setState((s) => ({
            ...s,
            status: "training",
            step: msg.step,
            loss: msg.loss,
            emaLoss: msg.emaLoss,
            stepsPerSec: msg.stepsPerSec,
            lossHistory: [...s.lossHistory.slice(-239), msg.emaLoss ?? msg.loss],
          }))
          break
        case "paused":
          setState((s) => ({ ...s, status: "paused" }))
          break
        case "token":
          setState((s) => ({ ...s, status: "generating", output: s.output + msg.char }))
          break
        case "genDone":
          setState((s) => ({ ...s, status: s.step > 0 ? "paused" : "ready" }))
          break
        case "exported": {
          const blob = new Blob([JSON.stringify(msg.payload)], { type: "application/json" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "voidgpt-weights.json"
          a.click()
          URL.revokeObjectURL(url)
          break
        }
        case "error":
          setState((s) => ({ ...s, status: "ready", error: msg.message }))
          break
      }
    }

    return () => worker.terminate()
  }, [])

  const build = useCallback((corpus: string, config: NetConfig, lr: number) => {
    setState((s) => ({ ...s, status: "building", error: null }))
    workerRef.current?.postMessage({ type: "init", corpus, config, lr })
  }, [])

  const start = useCallback(() => {
    workerRef.current?.postMessage({ type: "start" })
    setState((s) => ({ ...s, status: "training" }))
  }, [])

  const pause = useCallback(() => {
    workerRef.current?.postMessage({ type: "pause" })
  }, [])

  const generate = useCallback((prompt: string, length: number, temperature: number) => {
    setState((s) => ({ ...s, output: "", status: "generating" }))
    workerRef.current?.postMessage({ type: "generate", prompt, length, temperature })
  }, [])

  const stopGenerate = useCallback(() => {
    workerRef.current?.postMessage({ type: "stopGenerate" })
  }, [])

  const exportModel = useCallback(() => {
    workerRef.current?.postMessage({ type: "export" })
  }, [])

  return { state, build, start, pause, generate, stopGenerate, exportModel }
}
