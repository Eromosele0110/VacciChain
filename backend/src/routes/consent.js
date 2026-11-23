const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getConsent, recordConsent } = require('../indexer/db');
const validate = require('../middleware/validate');
const { recordConsentSchema } = require('./schemas/consent.schemas');
const { AppError } = require('../middleware/errors');

const router = express.Router();

/**
 * @swagger
 * /v1/patient/consent/{wallet}:
 *   get:
 *     summary: Get consent status for a wallet
 *     tags:
 *       - Consent
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: wallet
 *         required: true
 *         schema: { type: string }
 *         description: Stellar wallet address
 *     responses:
 *       200:
 *         description: Consent status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - patients may only read their own consent
 */

/**
 * GET /patient/consent/:wallet
 * Returns consent status for a wallet.
 * Object-level authorization (#45): patients may only read their own consent;
 * issuers and admins may read any wallet's consent.
 */
router.get('/consent/:wallet', authMiddleware, (req, res, next) => {
  const { wallet } = req.params;

  if (req.user.role === 'patient' && req.user.wallet !== wallet) {
    return next(new AppError('forbidden', 'Patients may only access their own consent data', 403));
  }

  const consent = getConsent(wallet);
  res.json({ wallet, consented: !!consent, consented_at: consent?.consented_at ?? null });
});

/**
 * @swagger
 * /v1/patient/consent:
 *   post:
 *     summary: Record explicit patient consent
 *     tags:
 *       - Consent
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               wallet:
 *                 type: string
 *             required:
 *               - wallet
 *     responses:
 *       201:
 *         description: Consent recorded
 *       401:
 *         description: Unauthorized
 */

/**
 * POST /patient/consent
 * Record explicit patient consent. Requires patient JWT.
 */
router.post('/consent', authMiddleware, validate(recordConsentSchema), (req, res, next) => {
  const { publicKey } = req.user;
  if (getConsent(publicKey)) {
    return res.json({ success: true, wallet: publicKey, already_consented: true });
  }
  recordConsent(publicKey);
  res.status(201).json({ success: true, wallet: publicKey });
});

module.exports = router;
