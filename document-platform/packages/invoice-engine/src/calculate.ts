import { Dec, RoundingMode, sum } from './decimal';
import { minorUnits } from './currency';
import { documentType } from './document-types';
import { intraStateTaxCode, isEuCountry } from './regions';
import { validateEuVatId } from './tax-ids';

export type TaxRegime = 'IN_GST' | 'EU_VAT' | 'GENERIC' | 'NONE';
export type TaxCategory = 'STANDARD' | 'ZERO' | 'EXEMPT' | 'NON_TAXABLE';
export type SupplyKind = 'GOODS' | 'SERVICES';

export interface Party {
  /** ISO 3166-1 alpha-2, e.g. "IN", "DE". */
  country: string;
  /** India: two-digit GST state code, e.g. "27". */
  state?: string;
  taxId?: string;
  isBusiness?: boolean;
  /** India: Special Economic Zone unit or developer (zero-rated like exports). */
  isSez?: boolean;
}

export interface LineInput {
  quantity: string | number;
  unitPrice: string | number;
  discount?: { type: 'PERCENT' | 'AMOUNT'; value: string | number };
  /** Percent. GST: the combined rate (18 → CGST 9 + SGST 9, or IGST 18). */
  taxRate?: string | number;
  /** India compensation cess, percent of the taxable value. */
  cessRate?: string | number;
  taxCategory?: TaxCategory;
  supplyKind?: SupplyKind;
  /** GENERIC regime: any named taxes, each a percent of the taxable value. */
  genericTaxes?: Array<{ name: string; rate: string | number }>;
}

export interface CalculationInput {
  regime: TaxRegime;
  currency: string;
  documentType: string;
  seller: Party & { gstComposition?: boolean };
  buyer: Party;
  /** Defaults to the buyer's location. */
  placeOfSupply?: { country: string; state?: string };
  lines: LineInput[];
  /** Unit prices already include tax (common for retail and B2C). */
  pricesIncludeTax?: boolean;
  /** India exports / SEZ: pay IGST instead of supplying under LUT/bond. */
  exportWithPayment?: boolean;
  /** India: tax payable by the recipient under reverse charge. */
  reverseCharge?: boolean;
  /** EU B2C distance sales charged at the destination country's rate (rates supplied per line). */
  euOss?: boolean;
  /** LINE: round tax per line. DOCUMENT: round per tax rate on the summed taxable value. */
  taxRounding?: 'LINE' | 'DOCUMENT';
  /** Round the grand total to a whole currency unit and show the difference. */
  roundOffTotal?: boolean;
  rounding?: RoundingMode;
}

export interface TaxAmount {
  code: string;
  rate: string;
  amount: string;
}

export interface LineResult {
  gross: string;
  discount: string;
  taxable: string;
  taxes: TaxAmount[];
  total: string;
  /** Why this line carries no tax, if it does not (label key). */
  zeroReason?: string;
}

export type Treatment =
  | 'NO_TAX'
  | 'DOMESTIC'
  | 'INTRA_STATE'
  | 'INTER_STATE'
  | 'EXPORT'
  | 'SEZ'
  | 'INTRA_EU_B2B'
  | 'EU_OSS'
  | 'EXPORT_OUTSIDE_EU';

export interface CalculationResult {
  currency: string;
  scale: number;
  treatment: Treatment;
  lines: LineResult[];
  subtotal: string;
  discountTotal: string;
  taxableTotal: string;
  taxBreakdown: Array<{ code: string; rate: string; taxable: string; amount: string }>;
  /** Tax collected on this document (excludes reverse-charge tax). */
  taxTotal: string;
  /** Tax the recipient pays under reverse charge (shown, not collected). */
  reverseChargeTaxTotal: string;
  roundOff: string;
  grandTotal: string;
  /** Legal statements the document must print (label keys). */
  notes: string[];
  warnings: string[];
}

interface TaxRule {
  code: string;
  rate: Dec;
}

const HUNDRED = Dec.of(100);

export function calculateDocument(input: CalculationInput): CalculationResult {
  if (!input.lines.length) throw new RangeError('A document needs at least one line.');
  const type = documentType(input.documentType);
  const scale = minorUnits(input.currency);
  const mode = input.rounding ?? 'HALF_UP';
  const notes = new Set<string>();
  const warnings: string[] = [];
  const regime: TaxRegime = type.taxable ? input.regime : 'NONE';
  const context = resolveContext(regime, input, notes, warnings);

  const lines = input.lines.map((line) => {
    const quantity = Dec.of(line.quantity);
    const unitPrice = Dec.of(line.unitPrice);
    if (quantity.isNegative() || unitPrice.isNegative()) {
      throw new RangeError('Quantities and prices cannot be negative; use a credit note instead.');
    }
    const gross = quantity.mul(unitPrice);
    let discount = Dec.ZERO;
    if (line.discount) {
      const value = Dec.of(line.discount.value);
      if (value.isNegative()) throw new RangeError('Discounts cannot be negative.');
      discount = line.discount.type === 'PERCENT' ? gross.mul(value).div(HUNDRED, 10, mode) : value;
      if (discount.cmp(gross) > 0) discount = gross;
    }
    const net = gross.sub(discount);
    const { rules, zeroReason } = context.lineRules(line);
    const combined = rules.reduce((total, rule) => total.add(rule.rate), Dec.ZERO);

    const taxable = input.pricesIncludeTax && !combined.isZero()
      ? net.mul(HUNDRED).div(HUNDRED.add(combined), scale, mode)
      : net.round(scale, mode);
    const taxes = rules.map((rule) => ({
      code: rule.code,
      rate: rule.rate,
      exact: taxable.mul(rule.rate).div(HUNDRED, 10, mode),
    }));
    let lineTaxes = taxes.map((tax) => ({ ...tax, amount: tax.exact.round(scale, mode) }));
    if (input.pricesIncludeTax && lineTaxes.length) {
      // Make taxable + taxes equal the tax-inclusive price exactly: the last
      // tax absorbs the rounding difference.
      const target = net.round(scale, mode);
      const diff = target.sub(taxable).sub(sum(lineTaxes.map((tax) => tax.amount)));
      const last = lineTaxes.length - 1;
      lineTaxes = lineTaxes.map((tax, index) => (index === last ? { ...tax, amount: tax.amount.add(diff) } : tax));
    }
    return { gross, discount, taxable, taxes: lineTaxes, zeroReason };
  });

  // Breakdown per tax code and rate (zero-rated lines included: EU invoices
  // must show exempt/zero-rated amounts too).
  const groups = new Map<string, { code: string; rate: Dec; taxable: Dec; lineSum: Dec }>();
  for (const line of lines) {
    const entries = line.taxes.length
      ? line.taxes
      : [{ code: context.zeroCode, rate: Dec.ZERO, amount: Dec.ZERO, exact: Dec.ZERO }];
    for (const tax of entries) {
      const key = `${tax.code}|${tax.rate.toString()}`;
      const group = groups.get(key) ?? { code: tax.code, rate: tax.rate, taxable: Dec.ZERO, lineSum: Dec.ZERO };
      group.taxable = group.taxable.add(line.taxable);
      group.lineSum = group.lineSum.add(tax.amount);
      groups.set(key, group);
    }
  }
  const documentRounding = (input.taxRounding ?? (regime === 'EU_VAT' ? 'DOCUMENT' : 'LINE')) === 'DOCUMENT'
    && !input.pricesIncludeTax;
  const taxBreakdown = [...groups.values()]
    .filter((group) => group.code !== 'NONE')
    .map((group) => ({
      code: group.code,
      rate: group.rate,
      taxable: group.taxable,
      amount: documentRounding ? group.taxable.mul(group.rate).div(HUNDRED, scale, mode) : group.lineSum,
    }));

  const subtotal = sum(lines.map((line) => line.gross)).round(scale, mode);
  const discountTotal = sum(lines.map((line) => line.discount)).round(scale, mode);
  const taxableTotal = sum(lines.map((line) => line.taxable));
  const allTax = sum(taxBreakdown.map((group) => group.amount));
  const reverseCharge = context.reverseCharge ? allTax : Dec.ZERO;
  const taxTotal = context.reverseCharge ? Dec.ZERO : allTax;
  const beforeRoundOff = taxableTotal.add(taxTotal);
  const grandTotal = input.roundOffTotal ? beforeRoundOff.round(0, mode).round(scale) : beforeRoundOff;
  const fixed = (value: Dec) => value.toFixed(scale);

  return {
    currency: input.currency,
    scale,
    treatment: context.treatment,
    lines: lines.map((line) => ({
      gross: fixed(line.gross.round(scale, mode)),
      discount: fixed(line.discount.round(scale, mode)),
      taxable: fixed(line.taxable),
      taxes: line.taxes.map((tax) => ({ code: tax.code, rate: tax.rate.toString(), amount: fixed(tax.amount) })),
      total: fixed(line.taxable.add(context.reverseCharge ? Dec.ZERO : sum(line.taxes.map((tax) => tax.amount)))),
      ...(line.zeroReason ? { zeroReason: line.zeroReason } : {}),
    })),
    subtotal: fixed(subtotal),
    discountTotal: fixed(discountTotal),
    taxableTotal: fixed(taxableTotal),
    taxBreakdown: taxBreakdown.map((group) => ({
      code: group.code,
      rate: group.rate.toString(),
      taxable: fixed(group.taxable),
      amount: fixed(group.amount),
    })),
    taxTotal: fixed(taxTotal),
    reverseChargeTaxTotal: fixed(reverseCharge),
    roundOff: fixed(grandTotal.sub(beforeRoundOff)),
    grandTotal: fixed(grandTotal),
    notes: [...notes],
    warnings,
  };
}

interface Context {
  treatment: Treatment;
  reverseCharge: boolean;
  /** Code shown in the breakdown for untaxed lines ("NONE" hides them). */
  zeroCode: string;
  lineRules(line: LineInput): { rules: TaxRule[]; zeroReason?: string };
}

function rate(line: LineInput) {
  return Dec.of(line.taxRate ?? 0);
}

function untaxedCategory(line: LineInput) {
  const category = line.taxCategory ?? 'STANDARD';
  return category === 'STANDARD' ? null : category;
}

function resolveContext(
  regime: TaxRegime,
  input: CalculationInput,
  notes: Set<string>,
  warnings: string[],
): Context {
  if (regime === 'NONE') {
    if (input.documentType === 'BILL_OF_SUPPLY' || input.seller.gstComposition) notes.add('note.billOfSupply');
    return { treatment: 'NO_TAX', reverseCharge: false, zeroCode: 'NONE', lineRules: () => ({ rules: [] }) };
  }
  if (regime === 'GENERIC') {
    return {
      treatment: 'DOMESTIC',
      reverseCharge: false,
      zeroCode: 'TAX',
      lineRules: (line) => ({
        rules: line.genericTaxes?.length
          ? line.genericTaxes.map((tax) => ({ code: tax.name.trim().slice(0, 40) || 'TAX', rate: Dec.of(tax.rate) }))
          : rate(line).isZero()
            ? []
            : [{ code: 'TAX', rate: rate(line) }],
      }),
    };
  }
  return regime === 'IN_GST' ? indiaGst(input, notes) : euVat(input, notes, warnings);
}

function indiaGst(input: CalculationInput, notes: Set<string>): Context {
  if (input.seller.gstComposition) {
    // Composition dealers cannot charge GST; they issue a bill of supply.
    notes.add('note.composition');
    return { treatment: 'NO_TAX', reverseCharge: false, zeroCode: 'NONE', lineRules: () => ({ rules: [] }) };
  }
  const place = input.placeOfSupply ?? { country: input.buyer.country, state: input.buyer.state };
  const exported = place.country.toUpperCase() !== 'IN';
  const sez = !exported && Boolean(input.buyer.isSez);
  if (!exported && (!input.seller.state || !place.state)) {
    throw new RangeError('GST needs the seller state and the place of supply state.');
  }
  const reverseCharge = Boolean(input.reverseCharge) && !exported && !sez;
  if (reverseCharge) notes.add('note.reverseCharge');

  if (exported || sez) {
    const treatment: Treatment = exported ? 'EXPORT' : 'SEZ';
    const withPayment = Boolean(input.exportWithPayment);
    notes.add(withPayment ? 'note.exportWithPayment' : 'note.exportLut');
    return {
      treatment,
      reverseCharge: false,
      zeroCode: 'IGST',
      lineRules: (line) => {
        if (untaxedCategory(line)) return { rules: [], zeroReason: `reason.${untaxedCategory(line)!.toLowerCase()}` };
        if (!withPayment) return { rules: [], zeroReason: 'reason.zeroRatedLut' };
        return { rules: gstRules('IGST', line) };
      },
    };
  }

  const intra = input.seller.state === place.state;
  const stateCode = intraStateTaxCode(place.state!);
  return {
    treatment: intra ? 'INTRA_STATE' : 'INTER_STATE',
    reverseCharge,
    zeroCode: intra ? 'CGST' : 'IGST',
    lineRules: (line) => {
      const untaxed = untaxedCategory(line);
      if (untaxed) return { rules: [], zeroReason: `reason.${untaxed.toLowerCase()}` };
      if (!intra) return { rules: gstRules('IGST', line) };
      const half = rate(line).div(2, 4);
      const rules: TaxRule[] = half.isZero()
        ? []
        : [
            { code: 'CGST', rate: half },
            { code: stateCode, rate: half },
          ];
      return { rules: withCess(rules, line) };
    },
  };
}

function gstRules(code: string, line: LineInput): TaxRule[] {
  const rules = rate(line).isZero() ? [] : [{ code, rate: rate(line) }];
  return withCess(rules, line);
}

function withCess(rules: TaxRule[], line: LineInput): TaxRule[] {
  const cess = Dec.of(line.cessRate ?? 0);
  return cess.isZero() ? rules : [...rules, { code: 'CESS', rate: cess }];
}

function euVat(input: CalculationInput, notes: Set<string>, warnings: string[]): Context {
  const sellerCountry = input.seller.country.toUpperCase();
  if (!isEuCountry(sellerCountry)) throw new RangeError('EU VAT needs a seller established in an EU country.');
  const buyerCountry = (input.placeOfSupply?.country ?? input.buyer.country).toUpperCase();
  const domestic = buyerCountry === sellerCountry;
  const buyerInEu = isEuCountry(buyerCountry);
  const business = Boolean(input.buyer.isBusiness);

  let validBuyerVatId = false;
  if (buyerInEu && !domestic && business) {
    const check = input.buyer.taxId ? validateEuVatId(input.buyer.taxId, buyerCountry) : null;
    validBuyerVatId = Boolean(check?.valid);
    if (!validBuyerVatId) {
      warnings.push(
        'The customer has no valid EU VAT ID, so VAT is charged. Add their VAT ID to apply the reverse charge.',
      );
    }
  }

  const standard = (line: LineInput) => {
    const untaxed = untaxedCategory(line);
    if (untaxed) {
      notes.add(untaxed === 'EXEMPT' ? 'note.vatExempt' : 'note.zeroRated');
      return { rules: [], zeroReason: `reason.${untaxed.toLowerCase()}` };
    }
    return { rules: rate(line).isZero() ? [] : [{ code: 'VAT', rate: rate(line) }] };
  };

  if (domestic) return { treatment: 'DOMESTIC', reverseCharge: false, zeroCode: 'VAT', lineRules: standard };

  if (buyerInEu && business && validBuyerVatId) {
    return {
      treatment: 'INTRA_EU_B2B',
      reverseCharge: false,
      zeroCode: 'VAT',
      lineRules: (line) => {
        const goods = (line.supplyKind ?? 'GOODS') === 'GOODS';
        notes.add(goods ? 'note.intraEuGoods' : 'note.intraEuServices');
        return { rules: [], zeroReason: goods ? 'reason.intraEuGoods' : 'reason.reverseCharge' };
      },
    };
  }

  if (buyerInEu) {
    if (input.euOss) notes.add('note.oss');
    return { treatment: input.euOss ? 'EU_OSS' : 'DOMESTIC', reverseCharge: false, zeroCode: 'VAT', lineRules: standard };
  }

  // Outside the EU: goods are zero-rated exports; services to businesses are
  // outside the scope of EU VAT; services to consumers keep the seller's VAT
  // (general rule; specific services can differ, so the user can override the rate).
  return {
    treatment: 'EXPORT_OUTSIDE_EU',
    reverseCharge: false,
    zeroCode: 'VAT',
    lineRules: (line) => {
      if ((line.supplyKind ?? 'GOODS') === 'GOODS') {
        notes.add('note.exportEu');
        return { rules: [], zeroReason: 'reason.export' };
      }
      if (business) {
        notes.add('note.outsideScope');
        return { rules: [], zeroReason: 'reason.outsideScope' };
      }
      return standard(line);
    },
  };
}
