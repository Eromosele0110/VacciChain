const { describe, expect, it } = require('@jest/globals');
const {
  SCHEMA_VERSIONS,
  CURRENT_VERSION,
  validateVaccinationRecord,
  normalizeVaccinationRecord,
} = require('../src/schemas/vaccination.record.schema');

const now = new Date().toISOString();

const baseRecord = {
  token_id: '1',
  patient_address: 'GAAAAA...PATIENT',
  vaccine_name: 'MMR',
  date_administered: now,
  issuer: 'GAAAAA...ISSUER',
  timestamp: now,
};

describe('vaccination record schema (#41)', () => {
  it('defines supported schema versions', () => {
    expect(SCHEMA_VERSIONS).toEqual(['1', '2']);
    expect(CURRENT_VERSION).toBe('2');
  });

  it('accepts a valid current-version record', () => {
    const result = validateVaccinationRecord({ ...baseRecord, version: '2' });
    expect(result.valid).toBe(true);
    expect(result.data.version).toBe('2');
  });

  it('accepts a record without an explicit version', () => {
    const result = validateVaccinationRecord(baseRecord);
    expect(result.valid).toBe(true);
    expect(result.data.version).toBe('2');
  });

  it('rejects unknown fields', () => {
    const result = validateVaccinationRecord({
      ...baseRecord,
      version: '2',
      internal_note: 'should be rejected',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Unknown field/);
  });

  it('rejects non-object input', () => {
    expect(validateVaccinationRecord(null).valid).toBe(false);
    expect(validateVaccinationRecord('string').valid).toBe(false);
    expect(validateVaccinationRecord([1, 2]).valid).toBe(false);
    expect(validateVaccinationRecord(undefined).valid).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { patient_address, ...rest } = baseRecord;
    const result = validateVaccinationRecord(rest);
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.error) || typeof result.error === 'string').toBe(true);
  });

  it('rejects invalid vaccine_name length', () => {
    const result = validateVaccinationRecord({
      ...baseRecord,
      vaccine_name: 'x'.repeat(300),
    });
    expect(result.valid).toBe(false);
  });

  it('maps a legacy v1 record forward to the current version', () => {
    const legacy = { ...baseRecord, version: '1' };
    const result = validateVaccinationRecord(legacy);
    expect(result.valid).toBe(true);
    expect(result.data.version).toBe('2');
    expect(result.data.dose_number).toBeNull();
    expect(result.data.dose_series).toBeNull();
  });

  it('preserves optional v2 fields when present', () => {
    const result = validateVaccinationRecord({
      ...baseRecord,
      version: '2',
      dose_number: 2,
      dose_series: 3,
    });
    expect(result.valid).toBe(true);
    expect(result.data.dose_number).toBe(2);
    expect(result.data.dose_series).toBe(3);
  });

  it('normalizeVaccinationRecord upgrades v1 without validating', () => {
    const legacy = { ...baseRecord, version: '1' };
    const normalized = normalizeVaccinationRecord(legacy);
    expect(normalized.version).toBe('2');
    expect(normalized.dose_number).toBeNull();
    expect(normalized.dose_series).toBeNull();
  });
});
