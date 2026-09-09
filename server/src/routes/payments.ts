import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { Client } from 'minio';
import { config } from '../config.js';
import { query, getClient } from '../db/pool.js';

const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

const RECEIPT_BUCKET = config.minio.receiptBucket;

async function ensureReceiptBucket() {
  try {
    const exists = await minioClient.bucketExists(RECEIPT_BUCKET);
    if (!exists) {
      await minioClient.makeBucket(RECEIPT_BUCKET, 'us-east-1');
      console.log(`[minio] Created bucket: ${RECEIPT_BUCKET}`);
    } else {
      console.log(`[minio] Bucket "${RECEIPT_BUCKET}" is ready.`);
    }

    const readOnlyPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${RECEIPT_BUCKET}/*`],
        },
      ],
    };

    try {
      await minioClient.setBucketPolicy(RECEIPT_BUCKET, JSON.stringify(readOnlyPolicy));
      console.log(`[minio] Set public read policy for "${RECEIPT_BUCKET}"`);
    } catch (policyErr) {
      console.warn(`[minio] Note: receipt bucket policy:`, (policyErr as Error).message);
    }
  } catch (err) {
    console.warn(`[minio] Warning: Could not connect to receipt bucket (${RECEIPT_BUCKET}):`, (err as Error).message);
  }
}

interface CreatePaymentBody {
  amount: number;
  payeeId: string;
  receiptUrl: string;
  expensesApplied?: { expenseId: string; amountApplied: number }[];
  recurringItemsApplied?: { cycleItemId: string; amountApplied: number }[];
}

interface UpdateStatusBody {
  status: 'Confirmed' | 'Rejected';
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  ensureReceiptBucket().catch((err) => console.warn('[minio] Receipt bucket check error:', err.message));

  /**
   * POST /payments/receipt
   * Authenticated — upload a payment receipt image/screenshot
   * Stores in MinIO in bucket "og-bucket" under "receipts/" path
   */
  fastify.post('/payments/receipt', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as { id: string };

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No receipt file uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    if (!allowedTypes.includes(data.mimetype) && !data.mimetype.startsWith('image/')) {
      return reply.status(400).send({ error: 'Bad Request', message: 'File must be an image (JPEG, PNG, WebP)' });
    }

    // Max 10MB
    const maxSize = 10 * 1024 * 1024;
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of data.file) {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        return reply.status(400).send({ error: 'Bad Request', message: 'File too large (max 10MB)' });
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    let ext = data.mimetype.split('/')[1] || 'jpg';
    if (ext === 'jpeg') ext = 'jpg';
    const timestamp = Date.now();
    const randomSuffix = crypto.randomUUID().slice(0, 8);
    const fileName = `receipt_${userId}_${timestamp}_${randomSuffix}.${ext}`;
    // Store in og-bucket under "receipts/"
    const objectName = `receipts/${fileName}`;

    await minioClient.putObject(RECEIPT_BUCKET, objectName, buffer, buffer.length, {
      'Content-Type': data.mimetype,
    });

    const receiptUrl = `/receipts/${fileName}`;

    return reply.send({
      receiptUrl,
      objectName,
      message: 'Receipt uploaded successfully.',
    });
  });

  /**
   * GET /receipts/*
   * Public — stream receipt from MinIO with immutable cache headers and ETag validation
   */
  fastify.get('/receipts/*', async (request: FastifyRequest, reply: FastifyReply) => {
    const rawPath = (request.params as Record<string, string>)['*'] || '';
    if (!rawPath) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Receipt path required' });
    }

    // Support both "receipts/filename.jpg" and "filename.jpg"
    const cleanFileName = rawPath.replace(/^receipts\//, '').replace(/^receipts\//, '');
    const candidateKeys = [`receipts/${cleanFileName}`, cleanFileName, rawPath];

    for (const key of candidateKeys) {
      try {
        const stat = await minioClient.statObject(RECEIPT_BUCKET, key);
        const etag = stat.etag ? `"${stat.etag.replace(/"/g, '')}"` : undefined;

        if (etag && request.headers['if-none-match'] === etag) {
          return reply.status(304).send();
        }

        const stream = await minioClient.getObject(RECEIPT_BUCKET, key);

        reply.header('Content-Type', stat.metaData?.['content-type'] || 'image/jpeg');
        reply.header('Cache-Control', 'public, max-age=31536000, immutable');
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
        if (etag) reply.header('ETag', etag);
        if (stat.size) reply.header('Content-Length', stat.size);
        return reply.send(stream);
      } catch {
        // Try next candidate key
      }
    }

    return reply.status(404).send({ error: 'Not Found', message: 'Receipt image not found' });
  });

  /**
   * POST /payments
   * Authenticated — submit a new payment (status: Pending)
   */
  fastify.post('/payments', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: payerId } = request.user as { id: string };
    const { amount, payeeId, receiptUrl, expensesApplied = [], recurringItemsApplied = [] } = request.body as CreatePaymentBody;

    if (!amount || !payeeId || (expensesApplied.length === 0 && recurringItemsApplied.length === 0)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'amount, payeeId, and at least one expense or recurring item are required' });
    }

    if (!receiptUrl || typeof receiptUrl !== 'string' || !receiptUrl.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Receipt screenshot or image is required to submit a payment' });
    }

    // Validate amounts
    const sumApplied = expensesApplied.reduce((acc, e) => acc + e.amountApplied, 0)
                     + recurringItemsApplied.reduce((acc, r) => acc + r.amountApplied, 0);
                     
    if (Math.abs(sumApplied - amount) > 0.01) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Sum of applied items must equal amount' });
    }

    // Cannot pay yourself
    if (payerId === payeeId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Cannot pay yourself' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Validate that user doesn't already have pending/confirmed payments covering the applied expenses
      for (const ea of expensesApplied) {
        const { rows: partRows } = await client.query(
          `SELECT ep.amount_owed, e.creator_id, e.title, e.status
           FROM expense_participant ep
           JOIN expense e ON e.id = ep.expense_id
           WHERE ep.expense_id = $1 AND ep.user_id = $2`,
          [ea.expenseId, payerId]
        );

        if (partRows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: 'Bad Request', message: `You are not a participant in expense ${ea.expenseId}` });
        }

        if (partRows[0].creator_id === payerId) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: 'Bad Request', message: 'You cannot pay for an expense you created' });
        }

        if (partRows[0].status !== 'Confirmed') {
          await client.query('ROLLBACK');
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Payment cannot be submitted for "${partRows[0].title}" because the expense is ${partRows[0].status.toLowerCase()} and has not been approved by an administrator.`
          });
        }

        const { rows: [alreadyApplied] } = await client.query(
          `SELECT COALESCE(SUM(epm.amount_applied), 0) AS "totalApplied"
           FROM expense_payment epm
           JOIN payment p ON p.id = epm.payment_id
           WHERE epm.expense_id = $1 AND p.payer_id = $2 AND p.status IN ('Confirmed', 'Pending')`,
          [ea.expenseId, payerId]
        );

        const totalApplied = parseFloat(alreadyApplied.totalApplied);
        const amountOwed = parseFloat(partRows[0].amount_owed);
        const remainingAllowed = amountOwed - totalApplied;

        if (ea.amountApplied > remainingAllowed + 0.01) {
          await client.query('ROLLBACK');
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Payment for "${partRows[0].title}" cannot be submitted because a payment is already pending or completed (remaining payable: RM ${Math.max(0, remainingAllowed).toFixed(2)})`
          });
        }
      }

      // Validate recurring cycle items
      for (const ra of recurringItemsApplied) {
        const { rows: cycleRows } = await client.query(
          `SELECT rci.status, re.title, rc.period_key
           FROM recurring_cycle_item rci
           JOIN recurring_cycle rc ON rc.id = rci.cycle_id
           JOIN recurring_expense re ON re.id = rc.recurring_expense_id
           WHERE rci.id = $1 AND rci.user_id = $2`,
          [ra.cycleItemId, payerId]
        );

        if (cycleRows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: 'Bad Request', message: 'Subscription cycle not found' });
        }

        if (cycleRows[0].status !== 'Unpaid') {
          await client.query('ROLLBACK');
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Subscription "${cycleRows[0].title}" (${cycleRows[0].period_key}) is already paid or pending confirmation`
          });
        }
      }

      const { rows: [payment] } = await client.query(
        `INSERT INTO payment (amount, payer_id, payee_id, receipt_url, status)
         VALUES ($1, $2, $3, $4, 'Pending')
         RETURNING id, date, amount, payer_id AS "payerId", payee_id AS "payeeId", receipt_url AS "receiptUrl", status`,
        [amount, payerId, payeeId, receiptUrl.trim()]
      );

      for (const ea of expensesApplied) {
        await client.query(
          `INSERT INTO expense_payment (expense_id, payment_id, amount_applied) VALUES ($1, $2, $3)`,
          [ea.expenseId, payment.id, ea.amountApplied]
        );
      }

      for (const ra of recurringItemsApplied) {
        await client.query(
          `INSERT INTO recurring_payment (cycle_item_id, payment_id, amount_applied)
           VALUES ($1, $2, $3)`,
          [ra.cycleItemId, payment.id, ra.amountApplied]
        );
        await client.query(
          `UPDATE recurring_cycle_item
           SET payment_id = $1, status = 'Pending'
           WHERE id = $2`,
          [payment.id, ra.cycleItemId]
        );
      }

      await client.query('COMMIT');

      const { rows: [full] } = await client.query(
        `SELECT p.id, p.date, p.confirmed_date AS "confirmedDate", p.amount,
                p.payer_id AS "payerId", p.payee_id AS "payeeId", p.status,
                p.receipt_url AS "receiptUrl",
                p.confirmed_by AS "confirmedById", approver.name AS "confirmedByName",
                payer.name AS "payerName", payee.name AS "payeeName",
                COALESCE(
                  (SELECT json_agg(json_build_object('expenseId', epm.expense_id, 'amountApplied', epm.amount_applied))
                   FROM expense_payment epm WHERE epm.payment_id = p.id),
                  '[]'
                ) AS "expensesApplied",
                COALESCE(
                  (SELECT json_agg(json_build_object('cycleItemId', rci.id, 'amountApplied', rp.amount_applied, 'title', re.title, 'periodKey', rc.period_key))
                   FROM recurring_payment rp
                   JOIN recurring_cycle_item rci ON rci.id = rp.cycle_item_id
                   JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                   JOIN recurring_expense re ON re.id = rc.recurring_expense_id
                   WHERE rp.payment_id = p.id),
                  '[]'
                ) AS "recurringItemsApplied"
         FROM payment p
         JOIN "user" payer ON payer.id = p.payer_id
         JOIN "user" payee ON payee.id = p.payee_id
         LEFT JOIN "user" approver ON approver.id = p.confirmed_by
         WHERE p.id = $1`,
        [payment.id]
      );

      return reply.status(201).send(full);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * GET /payments
   * Authenticated — list payments with optional filters
   */
  fastify.get('/payments', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { status, payerId, payeeId, expenseId } = request.query as {
      status?: string;
      payerId?: string;
      payeeId?: string;
      expenseId?: string;
    };
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      if (status.includes(',')) {
        const statuses = status.split(',').map((s) => s.trim());
        params.push(statuses);
        conditions.push(`p.status = ANY($${params.length})`);
      } else {
        params.push(status);
        conditions.push(`p.status = $${params.length}`);
      }
    }
    if (payerId) {
      params.push(payerId);
      conditions.push(`p.payer_id = $${params.length}`);
    }
    if (payeeId) {
      params.push(payeeId);
      conditions.push(`p.payee_id = $${params.length}`);
    }
    if (expenseId) {
      params.push(expenseId);
      conditions.push(`EXISTS (SELECT 1 FROM expense_payment ep WHERE ep.payment_id = p.id AND ep.expense_id = $${params.length})`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT p.id, p.date, p.confirmed_date AS "confirmedDate", p.amount,
              p.payer_id AS "payerId", p.payee_id AS "payeeId", p.status,
              p.receipt_url AS "receiptUrl",
              p.confirmed_by AS "confirmedById", approver.name AS "confirmedByName",
              payer.name AS "payerName", payee.name AS "payeeName",
              COALESCE(
                (SELECT json_agg(json_build_object('expenseId', epm.expense_id, 'amountApplied', epm.amount_applied))
                 FROM expense_payment epm WHERE epm.payment_id = p.id),
                '[]'
              ) AS "expensesApplied",
              COALESCE(
                (SELECT json_agg(json_build_object('cycleItemId', rci.id, 'amountApplied', rp.amount_applied, 'title', re.title, 'periodKey', rc.period_key))
                 FROM recurring_payment rp
                 JOIN recurring_cycle_item rci ON rci.id = rp.cycle_item_id
                 JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                 JOIN recurring_expense re ON re.id = rc.recurring_expense_id
                 WHERE rp.payment_id = p.id),
                '[]'
              ) AS "recurringItemsApplied"
       FROM payment p
       JOIN "user" payer ON payer.id = p.payer_id
       JOIN "user" payee ON payee.id = p.payee_id
       LEFT JOIN "user" approver ON approver.id = p.confirmed_by
       ${where}
       ORDER BY p.date DESC`,
      params
    );

    return reply.send(rows);
  });

  /**
   * GET /payments/:id
   * Authenticated — retrieve single payment record
   */
  fastify.get('/payments/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { rows } = await query(
      `SELECT p.id, p.date, p.confirmed_date AS "confirmedDate", p.amount,
              p.payer_id AS "payerId", p.payee_id AS "payeeId", p.status,
              p.receipt_url AS "receiptUrl",
              p.confirmed_by AS "confirmedById", approver.name AS "confirmedByName",
              payer.name AS "payerName", payee.name AS "payeeName",
              COALESCE(
                (SELECT json_agg(json_build_object('expenseId', epm.expense_id, 'amountApplied', epm.amount_applied))
                 FROM expense_payment epm WHERE epm.payment_id = p.id),
                '[]'
              ) AS "expensesApplied",
              COALESCE(
                (SELECT json_agg(json_build_object('cycleItemId', rci.id, 'amountApplied', rp.amount_applied, 'title', re.title, 'periodKey', rc.period_key))
                 FROM recurring_payment rp
                 JOIN recurring_cycle_item rci ON rci.id = rp.cycle_item_id
                 JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                 JOIN recurring_expense re ON re.id = rc.recurring_expense_id
                 WHERE rp.payment_id = p.id),
                '[]'
              ) AS "recurringItemsApplied"
       FROM payment p
       JOIN "user" payer ON payer.id = p.payer_id
       JOIN "user" payee ON payee.id = p.payee_id
       LEFT JOIN "user" approver ON approver.id = p.confirmed_by
       WHERE p.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Payment not found' });
    }

    return reply.send(rows[0]);
  });

  /**
   * PATCH | POST | GET /payments/:id/status & /payments/:id/approve
   * Authenticated — approve or confirm a pending payment
   * Permitted for Admins, payees (recipients), or payers
   */
  const handleUpdatePaymentStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };
    const body = (request.body as Partial<UpdateStatusBody>) || {};
    const queryParams = (request.query as { status?: string }) || {};
    const status = body.status || queryParams.status || 'Confirmed';

    if (!status || !['Confirmed', 'Rejected'].includes(status)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'status must be "Confirmed" or "Rejected"' });
    }

    // Verify that user is the payee (the host of the expenses). Only the host can approve this payment.
    const { rows: payCheck } = await query(
      `SELECT payee_id AS "payeeId" FROM payment WHERE id = $1`,
      [id]
    );
    if (payCheck.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Payment not found' });
    }
    if (payCheck[0].payeeId !== userId && role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the host of the expenses (payment recipient) or an administrator can approve or reject this payment' });
    }

    const { rows } = await query(
      `UPDATE payment SET status = $1, confirmed_by = $2, confirmed_date = NOW(), updated_at = NOW()
       WHERE id = $3 AND status = 'Pending'
       RETURNING id, status, confirmed_date AS "confirmedDate", confirmed_by AS "confirmedById"`,
      [status, userId, id]
    );

    if (rows.length > 0 && status === 'Confirmed') {
      await query(
        `UPDATE recurring_cycle_item
         SET status = 'Paid', paid_at = NOW()
         WHERE payment_id = $1 AND status = 'Pending'`,
        [id]
      );
    } else if (rows.length > 0 && status === 'Rejected') {
      await query(
        `UPDATE recurring_cycle_item
         SET status = 'Unpaid', payment_id = NULL
         WHERE payment_id = $1 AND status = 'Pending'`,
        [id]
      );
    }

    if (rows.length === 0) {
      const { rows: existing } = await query(
        `SELECT p.id, p.status, p.confirmed_date AS "confirmedDate", p.confirmed_by AS "confirmedById", approver.name AS "confirmedByName"
         FROM payment p
         LEFT JOIN "user" approver ON approver.id = p.confirmed_by
         WHERE p.id = $1`,
        [id]
      );
      if (existing.length > 0) {
        return reply.send({ ...existing[0], message: `Payment is already ${existing[0].status.toLowerCase()}.` });
      }
      return reply.status(404).send({ error: 'Not Found', message: 'Payment not found' });
    }

    const { rows: approverRows } = await query('SELECT name FROM "user" WHERE id = $1', [userId]);
    const confirmedByName = approverRows[0]?.name || null;

    return reply.send({ ...rows[0], confirmedByName, message: `Payment ${status.toLowerCase()} successfully.` });
  };

  fastify.patch('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.post('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.get('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.patch('/payments/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.post('/payments/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
}