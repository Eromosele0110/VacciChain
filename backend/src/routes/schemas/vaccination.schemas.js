const { z } = require('zod');
const { issueRequestV1 } = require('../../schemas/vaccinationRecord');

/**
 * Validation schemas for vaccination routes.
 * Co-located with vaccination.js for easy maintenance.
 */

const revokeSchema = z.object({
  token_id: z.union([z.string(), z.number()])
    .transform((val) => String(val))
    .describe('Token ID to revoke'),
});

module.exports = {
  issueSchema: issueRequestV1,
  revokeSchema,
};
