const { z } = require('zod');

/**
 * Validation schemas for vaccination routes.
 * Co-located with vaccination.js for easy maintenance.
 */

const issueSchema = z.object({
  patient_address: z.string()
    .min(1, 'patient_address is required')
    .describe('Stellar address of patient'),
  vaccine_name: z.string()
    .min(1, 'vaccine_name is required')
    .max(256, 'vaccine_name must not exceed 256 characters')
    .describe('Name of the vaccine'),
  date_administered: z.string()
    .min(1, 'date_administered is required')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'date_administered must be a valid ISO date string',
    })
    .describe('ISO date string of when vaccine was administered'),
  dose_number: z.number()
    .int('dose_number must be an integer')
    .min(1, 'dose_number must be at least 1')
    .max(4294967295, 'dose_number must fit in an unsigned 32-bit integer')
    .optional()
    .describe('Dose number in series'),
  dose_series: z.number()
    .int('dose_series must be an integer')
    .min(1, 'dose_series must be at least 1')
    .max(4294967295, 'dose_series must fit in an unsigned 32-bit integer')
    .optional()
    .describe('Total doses in series'),
}).refine((r) => r.dose_number === undefined || r.dose_series === undefined || r.dose_number <= r.dose_series, {
  message: 'dose_number must not exceed dose_series',
  path: ['dose_number'],
});

const revokeSchema = z.object({
  token_id: z.union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe('Token ID to revoke'),
});

module.exports = {
  issueSchema,
  revokeSchema,
};
