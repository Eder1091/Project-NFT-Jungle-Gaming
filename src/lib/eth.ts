/**
 * Aritmética decimal exata para valores em ETH.
 * Valores trafegam como strings decimais ("1.19") e são calculados em BigInt (wei, 18 casas)
 * para evitar erros de ponto flutuante. Quantidades são sempre inteiras.
 */
const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)

export type EthString = string

export function toWei(value: EthString): bigint {
  const v = value.trim()
  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error(`Valor ETH inválido: "${value}"`)
  const [int, frac = ''] = v.split('.')
  const padded = (frac + '0'.repeat(DECIMALS)).slice(0, DECIMALS)
  return BigInt(int) * SCALE + BigInt(padded)
}

export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const int = abs / SCALE
  const frac = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${int}${frac ? '.' + frac : ''}`
}

export const addEth = (a: EthString, b: EthString): EthString => fromWei(toWei(a) + toWei(b))
export const subEth = (a: EthString, b: EthString): EthString => fromWei(toWei(a) - toWei(b))
export const mulEth = (a: EthString, qty: number): EthString => {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('Quantidade deve ser inteira e não negativa')
  return fromWei(toWei(a) * BigInt(qty))
}
/** Percentual exato (arredonda para baixo na menor unidade): percentEth('26.83', 10) => '2.683'. */
export const percentEth = (a: EthString, percent: number): EthString => {
  if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new Error('Percentual inválido')
  return fromWei((toWei(a) * BigInt(percent)) / 100n)
}
export const sumEth = (values: EthString[]): EthString => fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
export const compareEth = (a: EthString, b: EthString): number => {
  const d = toWei(a) - toWei(b)
  return d === 0n ? 0 : d < 0n ? -1 : 1
}

/** Exibe sem zeros à direita, com no mínimo `minFraction` casas ("1.19", "26.846", "2.00"). */
export function formatEth(value: EthString, minFraction = 2): string {
  const s = fromWei(toWei(value))
  const [int, frac = ''] = s.split('.')
  return `${int}.${frac.padEnd(minFraction, '0')}`
}
