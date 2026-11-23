/**
 * Issuer onboarding routes.
 *
 * POST /v1/onboarding/apply       — healthcare provider submits application (requires patient/issuer JWT)
 * GET  /v1/onboarding/applications — admin lists all applications (admin JWT required)
 * POST /v1/onboarding/applications/:id/review — admin approves or rejects (admin JWT required)
 */

const express = require('express');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const validate = require('../middleware/validate');
const { audit } = require('../middleware/auditLog');
const { addIssuer } = require('../stellar/soroban');
const { requireMultiSig } = require('../middleware/multiSig');
const {
  insertIssuerApplication,
  getIssuerApplication,
  listIssuerApplications,
  updateIssuerApplicationStatus,
} = require('../indexer/db');
const { applySchema, reviewSchema } = require('./schemas/onboarding.schemas');

const router = express.Router();

/**
 * @swagger
 * /v1/onboarding/apply:
 *   post:
 *     summary: Submit an issuer onboarding application
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - license_number
 *               - country
 *               - wallet
 *             properties:
 *               name:
 *                 type: string
 *               license_number:
 *                 type: string
 *               country:
 *                 type: string
 *               wallet:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application submitted
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Pending application already exists
 */

/**
 * @swagger
 * /v1/onboarding/applications:
 *   get:
 *     summary: List issuer onboarding applications
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *     responses:
 *       200:
 *         description: Application list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin required
 */

/**
 * @swagger
 * /v1/onboarding/applications/{id}/review:
 *   post:
 *     summary: Approve or reject an onboarding application
 *     tags:
 *       - Onboarding
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - decision
 *             properties:
 *               decision:
 *                 type: string
 *                 enum: [approved, rejected]
 *               reviewer_note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Application reviewed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin required
 */

function adminOnly(req, res, next) {
  if (req.user?.role !== 'issuer') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
 * Any authenticated user can submit an onboarding request.
 */
router.post('/apply', authMiddleware, validate(applySchema), async (req, res) => {
  const { name, license_number, country, wallet } = req.body;

  // Prevent duplicate applications from the same wallet
  const existing = listIssuerApplications().find(a => a.wallet === wallet && a.status === 'pending');
  if (existing) {
    return res.status(409).json({ error: 'A pending application already exists for this wallet.' });
  }

  const id = crypto.randomUUID();
  insertIssuerApplication({ id, wallet, name, license_number, country, submitted_at: new Date().toISOString() });

  audit({ actor: req.user.wallet, action: 'onboarding.apply', result: 'submitted', meta: { id, wallet } });

  res.status(201).json({ id, status: 'pending', message: 'Application submitted. You will be notified of the outcome.' });
});

/**
 * GET /onboarding/applications
 * Admin only — list all applications, optionally filtered by status.
 */
router.get('/applications', authMiddleware, adminOnly, (req, res) => {
  const { status } = req.query;
  const allowed = ['pending', 'approved', 'rejected'];
  if (status && !allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  res.json(listIssuerApplications({ status }));
});

/**
 * POST /onboarding/applications/:id/review
 * Admin only — approve or reject an application.
 * On approval, the wallet is added to the contract issuer allowlist.
 * Requires M-of-N multi-sig approval (see MULTISIG_THRESHOLD env var).
 */
router.post('/applications/:id/review', authMiddleware, adminOnly, validate(reviewSchema), requireMultiSig('onboarding_review'), async (req, res) => {
  const application = getIssuerApplication(req.params.id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found' });
  }
  if (application.status !== 'pending') {
    return res.status(409).json({ error: `Application is already ${application.status}` });
  }

  const { decision, reviewer_note } = req.body;

  if (decision === 'approved') {
    try {
      await addIssuer(application.wallet);
    } catch (err) {
      return res.status(502).json({ error: `Contract call failed: ${err.message}` });
    }
  }

  updateIssuerApplicationStatus(req.params.id, { status: decision, reviewer_note });

  audit({
    actor: req.user.wallet,
    action: `onboarding.${decision}`,
    result: decision,
    meta: { applicationId: req.params.id, applicantWallet: application.wallet },
  });

  res.json({ id: req.params.id, status: decision, wallet: application.wallet });
});

module.exports = router;
