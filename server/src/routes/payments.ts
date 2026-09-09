import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, getClient } from '../db/pool.js';

interface CreatePaymentBody {
  amount: number;
  payeeId: string;
  expensesApplied?: { expenseId: string; amountApplied: number }[];
  recurringItemsApplied?: { cycleItemId: string; amountApplied: number }[];
}

interface UpdateStatusBody {
  status: 'Confirmed' | 'Rejected';
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  /**
   * POST /payments
   * Authenticated — submit a new payment (status: Pending)
   */
  fastify.post('/payments', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: payerId } = request.user as { id: string };
    const { amount, payeeId, expensesApplied = [], recurringItemsApplied = [] } = request.body as CreatePaymentBody;

    if (!amount || !payeeId || (expensesApplied.length === 0 && recurringItemsApplied.length === 0)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'amount, payeeId, and at least one expense or recurring item are required' });
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
          `SELECT ep.amount_owed, e.creator_id, e.title
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
        `INSERT INTO payment (amount, payer_id, payee_id, status)
         VALUES ($1, $2, $3, 'Pending')
         RETURNING id, date, amount, payer_id AS "payerId", payee_id AS "payeeId", status`,
        [amount, payerId, payeeId]
      );

      for (const ea of expensesApplied) {
        await client.query(
          `INSERT INTO expense_payment (expense_id, payment_id, amount_applied) VALUES ($1, $2, $3)`,
          [ea.expenseId, payment.id, ea.amountApplied]
        );
      }

      for (const ra of recurringItemsApplied) {
        await client.query(
          `UPDATE recurring_cycle_item
           SET payment_id = $1, status = 'Pending'
           WHERE id = $2`,
          [payment.id, ra.cycleItemId]
        );
      }

      await client.query('COMMIT');

      const { rows: [full] } = await client.query(
        `SELECT p.*,
           COALESCE(
             (SELECT json_agg(json_build_object('expenseId', epm.expense_id, 'amountApplied', epm.amount_applied))
              FROM expense_payment epm WHERE epm.payment_id = p.id),
             '[]'
           ) AS "expensesApplied",
           COALESCE(
             (SELECT json_agg(json_build_object('cycleItemId', rci.id, 'amountApplied', rci.amount_due, 'title', re.title))
              FROM recurring_cycle_item rci
              JOIN recurring_cycle rc ON rc.id = rci.cycle_id
              JOIN recurring_expense re ON re.id = rc.recurring_expense_id
              WHERE rci.payment_id = p.id),
             '[]'
           ) AS "recurringItemsApplied"
         FROM payment p
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
              p.confirmed_by AS "confirmedById", approver.name AS "confirmedByName",
              payer.name AS "payerName", payee.name AS "payeeName",
              COALESCE(
                (SELECT json_agg(json_build_object('expenseId', epm.expense_id, 'amountApplied', epm.amount_applied))
                 FROM expense_payment epm WHERE epm.payment_id = p.id),
                '[]'
              ) AS "expensesApplied",
              COALESCE(
                (SELECT json_agg(json_build_object('cycleItemId', rci.id, 'amountApplied', rci.amount_due, 'title', re.title, 'periodKey', rc.period_key))
                 FROM recurring_cycle_item rci
                 JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                 JOIN recurring_expense re ON re.id = rc.recurring_expense_id
                 WHERE rci.payment_id = p.id),
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
        return reply.send({ ...existing[0], message: 'Payment is already confirmed.' });
      }
      return reply.status(404).send({ error: 'Not Found', message: 'Payment not found' });
    }

    const { rows: approverRows } = await query('SELECT name FROM "user" WHERE id = $1', [userId]);
    const confirmedByName = approverRows[0]?.name || null;

    return reply.send({ ...rows[0], confirmedByName, message: status === 'Confirmed' ? 'Payment confirmed successfully.' : 'Payment rejected.' });
  };

  fastify.patch('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.post('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.get('/payments/:id/status', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.patch('/payments/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
  fastify.post('/payments/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdatePaymentStatus);
}