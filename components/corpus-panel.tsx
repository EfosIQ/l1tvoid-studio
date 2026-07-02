"use client"

import { PRESETS } from "@/lib/nn/presets"
import type { NetConfig } from "@/hooks/use-voidgpt"

export const SIZES: Array<{ id: string; name: string; note: string; config: NetConfig }> = [
  {
    id: "nano",
    name: "НАНО",
    note: "~25K параметров · летает на любом телефоне",
    config: { blockSize: 32, nEmbd: 32, nHead: 2, nLayer: 2 },
  },
  {
    id: "micro",
    name: "МИКРО",
    note: "~90K параметров · баланс скорости и качества",
    config: { blockSize: 48, nEmbd: 48, nHead: 3, nLayer: 2 },
  },
  {
    id: "mini",
    name: "МИНИ",
    note: "~230K параметров · медленнее, но умнее",
    config: { blockSize: 64, nEmbd: 64, nHead: 4, nLayer: 3 },
  },
]

interface Props {
  corpus: string
  setCorpus: (c: string) => void
  sizeId: string
  setSizeId: (s: string) => void
  disabled: boolean
}

export function CorpusPanel({ corpus, setCorpus, sizeId, setSizeId, disabled }: Props) {
  return (
    <section aria-labelledby="corpus-title" className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <span className="text-primary text-xs font-bold">01</span>
        <h2 id="corpus-title" className="text-sm font-bold tracking-widest">
          ОБУЧАЮЩИЕ ДАННЫЕ
        </h2>
        <span className="font-sans text-xs italic text-muted-foreground">
          {"на чём сеть будет учиться"}
        </span>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Готовые корпусы">
        {PRESETS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            onClick={() => setCorpus(p.text)}
            className={`border-2 border-border bg-secondary px-3 py-2 text-xs font-semibold tracking-wider text-secondary-foreground transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40 ${
              i % 2 === 0 ? "tilt-l" : "tilt-r"
            }`}
          >
            {p.name}
            <span className="ml-2 font-sans font-normal italic text-muted-foreground">{p.hint}</span>
          </button>
        ))}
      </div>

      <div className="tilt-r border-2 border-dashed border-border bg-card p-1">
        <label htmlFor="corpus-input" className="sr-only">
          Текст обучающего корпуса
        </label>
        <textarea
          id="corpus-input"
          value={corpus}
          onChange={(e) => setCorpus(e.target.value)}
          disabled={disabled}
          rows={6}
          placeholder="Вставь сюда любой текст — сеть выучит его стиль..."
          className="w-full resize-y bg-transparent p-3 text-sm leading-relaxed text-card-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
        />
        <p className="px-3 pb-2 text-right text-xs text-muted-foreground">
          {corpus.length.toLocaleString("ru-RU")} символов
        </p>
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Размер модели">
        {SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={sizeId === s.id}
            disabled={disabled}
            onClick={() => setSizeId(s.id)}
            className={`flex min-h-11 items-center justify-between gap-3 border-2 px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40 ${
              sizeId === s.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
            }`}
          >
            <span className="text-xs font-bold tracking-widest">{s.name}</span>
            <span className="font-sans text-xs italic">{s.note}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
