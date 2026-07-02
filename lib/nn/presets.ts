// Готовые обучающие корпусы. Маленькие, чтобы сеть быстро уловила паттерн на телефоне.

export interface Preset {
  id: string
  name: string
  hint: string
  text: string
}

const PUSHKIN = `Буря мглою небо кроет,
Вихри снежные крутя;
То, как зверь, она завоет,
То заплачет, как дитя,
То по кровле обветшалой
Вдруг соломой зашумит,
То, как путник запоздалый,
К нам в окошко застучит.
Наша ветхая лачужка
И печальна и темна.
Что же ты, моя старушка,
Приумолкла у окна?
Или бури завыванья
Ты, мой друг, утомлена,
Или дремлешь под жужжанье
Своего веретена?
Выпьем, добрая подружка
Бедной юности моей,
Выпьем с горя; где же кружка?
Сердцу будет веселей.
Спой мне песню, как синица
Тихо за морем жила;
Спой мне песню, как девица
За водой поутру шла.
`.repeat(4)

const TERMINAL = `void@l1t:~$ init model --arch transformer
[ok] tokenizer built, vocab=64
[ok] parameters allocated
void@l1t:~$ train --steps 2000 --lr 0.003
[step 0100] loss 3.214 :: warming up
[step 0500] loss 2.107 :: patterns forming
[step 1000] loss 1.643 :: converging
[step 1500] loss 1.201 :: stable gradient flow
[step 2000] loss 0.984 :: done
void@l1t:~$ generate --prompt "hello" --temp 0.8
> system online. neural core stabilized.
void@l1t:~$ export --format json > voidgpt.weights
[ok] saved 128kb
void@l1t:~$ status
uptime: on-device / offline / private
`.repeat(6)

const CODE = `function attention(q, k, v) {
  const scores = matmul(q, transpose(k))
  const probs = softmax(scale(scores, 1 / Math.sqrt(dim)))
  return matmul(probs, v)
}

function block(x) {
  x = add(x, attention(norm(x)))
  x = add(x, mlp(norm(x)))
  return x
}

function forward(tokens) {
  let x = embed(tokens)
  for (const layer of layers) x = block(x)
  return head(norm(x))
}
`.repeat(8)

export const PRESETS: Preset[] = [
  { id: "pushkin", name: "ПУШКИН", hint: "русские стихи", text: PUSHKIN },
  { id: "terminal", name: "ТЕРМИНАЛ", hint: "логи лаборатории", text: TERMINAL },
  { id: "code", name: "КОД", hint: "js-трансформер", text: CODE },
]
