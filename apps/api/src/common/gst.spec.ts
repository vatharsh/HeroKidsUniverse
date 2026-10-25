import { financialYear, isIndianState, splitInclusiveGst, stateCode } from './gst';

describe('GST helpers', () => {
  it('splits an inclusive price into taxable + CGST/SGST for our own state', () => {
    const s = splitInclusiveGst(149, 18, 'Haryana', 'Haryana');
    expect(s).toEqual({ taxable: 126.27, cgst: 11.37, sgst: 11.36, igst: 0, tax: 22.73, placeOfSupply: 'Haryana' });
    expect(s.taxable + s.cgst + s.sgst).toBeCloseTo(149, 2);
  });

  it('uses IGST for another state', () => {
    const s = splitInclusiveGst(699, 18, 'Haryana', 'Maharashtra');
    expect(s).toMatchObject({ taxable: 592.37, igst: 106.63, cgst: 0, sgst: 0, placeOfSupply: 'Maharashtra' });
  });

  it('treats an unknown state as our own (place of supply = supplier location)', () => {
    expect(splitInclusiveGst(135, 18, 'Haryana', null).placeOfSupply).toBe('Haryana');
    expect(splitInclusiveGst(135, 18, 'Haryana', 'Atlantis').placeOfSupply).toBe('Haryana');
  });

  it('works out the Indian financial year in IST', () => {
    expect(financialYear(new Date('2026-10-25T10:00:00Z'))).toBe('2026-27');
    expect(financialYear(new Date('2027-03-31T18:00:00Z'))).toBe('2026-27'); // 11:30 pm IST, 31 March
    expect(financialYear(new Date('2027-03-31T18:31:00Z'))).toBe('2027-28'); // 12:01 am IST, 1 April
  });

  it('knows state names and codes', () => {
    expect(isIndianState('Delhi')).toBe(true);
    expect(isIndianState('delhi')).toBe(false);
    expect(stateCode('Haryana')).toBe('06');
  });
});
