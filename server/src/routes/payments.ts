import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool.js';

interface CreatePaymentBody {
  amount: number;
  payeeId: string;
  expensesApplied: { expenseId: string; amountApplied: number }[];
}

interface UpdateStatusBody {
  status: 'Confirmed';
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  /**
   * POST /payments
   * Authenticated — submit a new payment (status: Pending)
   */
  fastify.post('/payments', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: payerId } = request.user as { id: string };
    const { amount, payeeId, expensesApplied } = request.body as CreatePaymentBody;

    if (!amount || !payeeId || !expensesApplied || expensesApplied.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'amount, payeeId, and expensesApplied are required' });
    }

    // Validate amounts
    const sumApplied = expensesApplied.reduce((acc, e) => acc + e.amountApplied, 0);
    if (Math.abs(sumApplied - amount) > 0.01) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Sum of expensesApplied must equal amount' });
    }

    // Cannot pay yourself
    if (payerId === payeeId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Cannot pay yourself' });
    }

    const client = await query('BEGIN');
    try {
      const { rows: [payment] } = await query(
        `INSERT INTO payment (amount, payer_id, payee_id, status)
         VALUES ($1, $2, $3, 'Pending')
         RETURNING id, date, amount, payer_id AS "payerId", payee_id AS "payeeId", status`,
        [amount, payerId, payeeId]
      );

      for (const ea of expensesApplied) {
        await query(
          `INSERT INTO expense_payment (expense_id, payment_id, amount_applied) VALUES ($1, $2, $3)`,
          [ea.expenseId, payment.id, ea.amountApplied]
        );
      }

      await query('COMMIT');

      const { rows: [full] } = await query(
        `SELECT p.*, COALESCE(json_agg(json_build_object('expenseId', epm.expense_id, 'amountApplied', epm.amount_applied)) FILTER (WHERE epm.expense_id IS NOT NULL), '[]') AS "expensesApplied"
         FROM payment p
         LEFT JOIN expense_payment epm ON epm.payment_id = p.id
         WHERE p.id = $1
         GROUP BY p.id`,
        [payment.id]
      );

      return reply.status(201).send(full);
    } catch (err) {
      await query('ROLLBACK');
      throw err;
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
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
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
              payer.name AS "payerName", payee.name AS "payeeName",
              COALESCE(json_agg(json_build_object('expenseId', epm.expense_id, 'amountApplied', epm.amount_applied)) FILTER (WHERE epm.expense_id IS NOT NULL), '[]') AS "expensesApplied"
       FROM payment p
       JOIN "user" payer ON payer.id = p.payer_id
       JOIN "user" payee ON payee.id = p.payee_id
       LEFT JOIN expense_payment epm ON epm.payment_id = p.id
       ${where}
       GROUP BY p.id, payer.id, payee.id
       ORDER BY p.date DESC`,
      params
    );

    return reply.send(rows);
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

    if (!status || !['Confirmed'].includes(status)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'status must be "Confirmed"' });
    }

    // If not Admin, verify that user is the payee or payer
    if (role !== 'Admin') {
      const { rows: payCheck } = await query(
        `SELECT 1 FROM payment WHERE id = $1 AND (payee_id = $2 OR payer_id = $2)`,
        [id, userId]
      );
      if (payCheck.length === 0) {
        return reply.status(403).send({ error: 'Forbidden', message: 'You do not have permission to confirm this payment' });
      }
    }

    const { rows } = await query(
      `UPDATE payment SET status = $1, confirmed_date = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'Pending'
       RETURNING id, status, confirmed_date AS "confirmedDate"`,
      [status, id]
    );

    if (rows.length === 0) {
      const { rows: existing } = await query('SELECT id, status, confirmed_date AS "confirmedDate" FROM payment WHERE id = $1', [id]);
      if (existing.length > 0) {
        return reply.send({ id: existing[0].id, status: existing[0].status, message: 'Payment is already confirmed.' });
      }
      return reply.status(404).send({ error: 'Not Found', message: 'Payment not found' });
    }

    return reply.send({ ...rows[0], message: 'Payment confirmed successfully.' });
  };

  fastify.patch('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.post('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.get('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.patch('/payments/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.post('/payments/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
}