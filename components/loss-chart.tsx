"use client"

// Осциллограф лосса — рисуем сами на canvas, без библиотек.

import { useEffect, useRef } from "react"

export function LossChart({ history }: { history: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    const styles = getComputedStyle(canvas)
    const lime = styles.getPropertyValue("--color-chart-1").trim() || "#b8e63c"
    const gridCol = styles.getPropertyValue("--color-border").trim() || "#3a3b42"
    const mutedCol = styles.getPropertyValue("--color-muted-foreground").trim() || "#9a9b8e"

    // Сетка осциллографа
    ctx.strokeStyle = gridCol
    ctx.lineWidth = 0.5
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    if (history.length < 2) {
      ctx.fillStyle = mutedCol
      ctx.font = "11px monospace"
      ctx.fillText("ожидание сигнала...", 12, h / 2)
      return
    }

    const max = Math.max(...history)
    const min = Math.min(...history)
    const range = Math.max(max - min, 0.01)
    const pad = 8

    // Кривая лосса
    ctx.strokeStyle = lime
    ctx.lineWidth = 2
    ctx.lineJoin = "round"
    ctx.beginPath()
    history.forEach((v, i) => {
      const x = pad + (i / (history.length - 1)) * (w - pad * 2)
      const y = pad + ((max - v) / range) * (h - pad * 2)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Точка текущего значения
    const lastX = w - pad
    const lastY = pad + ((max - history[history.length - 1]) / range) * (h - pad * 2)
    ctx.fillStyle = lime
    ctx.beginPath()
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
    ctx.fill()

    // Подписи min/max
    ctx.fillStyle = mutedCol
    ctx.font = "10px monospace"
    ctx.fillText(max.toFixed(3), 4, 12)
    ctx.fillText(min.toFixed(3), 4, h - 4)
  }, [history])

  return (
    <canvas
      ref={canvasRef}
      className="h-32 w-full"
      role="img"
      aria-label="График функции потерь во время обучения"
    />
  )
}
