export type Signal = "buy" | "sell" | "hold";

const sma = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Einfacher SMA-Crossover: kreuzt der schnelle gleitende Durchschnitt den langsamen
 * nach oben -> buy, nach unten -> sell. Bewusst simpel; eigene Strategien hier einbauen.
 */
export class SmaCrossover {
  private prices: number[] = [];
  private lastDiff: number | null = null;

  constructor(private fast: number, private slow: number) {}

  update(price: number): Signal {
    this.prices.push(price);
    if (this.prices.length > this.slow) this.prices.shift();
    if (this.prices.length < this.slow) return "hold";

    const diff = sma(this.prices.slice(-this.fast)) - sma(this.prices);
    const prev = this.lastDiff;
    this.lastDiff = diff;
    if (prev === null) return "hold";
    if (prev <= 0 && diff > 0) return "buy";
    if (prev >= 0 && diff < 0) return "sell";
    return "hold";
  }

  get warmup(): string {
    return `${this.prices.length}/${this.slow}`;
  }
}
