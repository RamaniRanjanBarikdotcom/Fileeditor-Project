/**
 * Exact decimal arithmetic on BigInt (value × 10^-scale). Money is never
 * computed with JavaScript floats: 0.1 + 0.2 must be 0.3 on an invoice.
 */

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP';

const TEN = BigInt(10);
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

function pow10(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

function abs(value: bigint) {
  return value < ZERO ? -value : value;
}

/** Integer division with explicit rounding (values may be negative). */
function divRound(numerator: bigint, denominator: bigint, mode: RoundingMode): bigint {
  if (denominator === ZERO) throw new RangeError('Division by zero.');
  const negative = numerator < ZERO !== denominator < ZERO;
  const n = abs(numerator);
  const d = abs(denominator);
  let quotient = n / d;
  const remainder = n % d;
  if (remainder !== ZERO) {
    const twice = remainder * TWO;
    const roundAway =
      mode === 'UP' ||
      (mode === 'HALF_UP' && twice >= d) ||
      (mode === 'HALF_EVEN' && (twice > d || (twice === d && quotient % TWO === ONE)));
    if (roundAway) quotient += ONE;
  }
  return negative ? -quotient : quotient;
}

export class Dec {
  private constructor(
    readonly units: bigint,
    readonly scale: number,
  ) {}

  static readonly ZERO = new Dec(ZERO, 0);

  /** Parses "12", "-0.125", "1e3" is rejected: amounts must be plain decimals. */
  static of(value: string | number | bigint | Dec): Dec {
    if (value instanceof Dec) return value;
    if (typeof value === 'bigint') return new Dec(value, 0);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new RangeError('Not a finite number.');
      // Shortest round-trip representation, e.g. 0.1 -> "0.1" (never 0.1000000000000000055).
      value = String(value);
      if (/e/i.test(value)) value = Number(value).toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
    }
    const text = value.trim();
    const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(text) ?? /^([+-])?()\.(\d+)$/.exec(text);
    if (!match) throw new RangeError(`"${value}" is not a decimal number.`);
    const [, sign, whole, fraction = ''] = match;
    const units = BigInt(`${whole || '0'}${fraction}`) * (sign === '-' ? -ONE : ONE);
    return new Dec(units, fraction.length);
  }

  private aligned(other: Dec): [bigint, bigint, number] {
    const scale = Math.max(this.scale, other.scale);
    return [this.units * pow10(scale - this.scale), other.units * pow10(scale - other.scale), scale];
  }

  add(other: Dec | string | number): Dec {
    const [a, b, scale] = this.aligned(Dec.of(other));
    return new Dec(a + b, scale);
  }

  sub(other: Dec | string | number): Dec {
    const [a, b, scale] = this.aligned(Dec.of(other));
    return new Dec(a - b, scale);
  }

  mul(other: Dec | string | number): Dec {
    const b = Dec.of(other);
    return new Dec(this.units * b.units, this.scale + b.scale);
  }

  /** Division rounded to `scale` decimal places. */
  div(other: Dec | string | number, scale: number, mode: RoundingMode = 'HALF_UP'): Dec {
    const b = Dec.of(other);
    // (a / 10^sa) / (b / 10^sb) = (a × 10^(scale + sb - sa) / b) / 10^scale
    const shift = scale + b.scale - this.scale;
    const numerator = shift >= 0 ? this.units * pow10(shift) : this.units;
    const denominator = shift >= 0 ? b.units : b.units * pow10(-shift);
    return new Dec(divRound(numerator, denominator, mode), scale);
  }

  round(scale: number, mode: RoundingMode = 'HALF_UP'): Dec {
    if (scale >= this.scale) return new Dec(this.units * pow10(scale - this.scale), scale);
    return new Dec(divRound(this.units, pow10(this.scale - scale), mode), scale);
  }

  neg(): Dec {
    return new Dec(-this.units, this.scale);
  }

  cmp(other: Dec | string | number): -1 | 0 | 1 {
    const [a, b] = this.aligned(Dec.of(other));
    return a === b ? 0 : a < b ? -1 : 1;
  }

  eq(other: Dec | string | number) {
    return this.cmp(other) === 0;
  }

  isZero() {
    return this.units === ZERO;
  }

  isNegative() {
    return this.units < ZERO;
  }

  /** Fixed-point text; with `scale` pads or rounds (HALF_UP) to exactly that many places. */
  toFixed(scale?: number): string {
    const value = scale === undefined ? this : this.round(scale);
    const digits = abs(value.units).toString().padStart(value.scale + 1, '0');
    const whole = value.scale ? digits.slice(0, -value.scale) : digits;
    const fraction = value.scale ? `.${digits.slice(-value.scale)}` : '';
    return `${value.units < ZERO ? '-' : ''}${whole}${fraction}`;
  }

  /** Shortest exact text (trailing fractional zeros removed). */
  toString(): string {
    const text = this.toFixed();
    return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
  }

  /** For display and JSON only; never feed back into money arithmetic. */
  toNumber(): number {
    return Number(this.toFixed());
  }

  toJSON() {
    return this.toString();
  }
}

export function sum(values: Array<Dec | string | number>): Dec {
  return values.reduce<Dec>((total, value) => total.add(value), Dec.ZERO);
}
