import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  /**
   * GET /dashboard/stats
   * Authenticated — returns the current user's balance overview
   */
  fastify.get('/dashboard/stats', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as { id: string };

    // Total owed by user (sum of their shares across all confirmed expenses)
    const { rows: [owedRow] } = await query(
      `SELECT COALESCE(SUM(ep.amount_owed), 0) AS "totalOwed"
       FROM expense_participant ep
       JOIN expense e ON e.id = ep.expense_id
       WHERE ep.user_id = $1 AND e.status = 'Confirmed'`,
      [userId]
    );

    // Confirmed payments made by user
    const { rows: [confirmedRow] } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS "confirmedPayments"
       FROM payment
       WHERE payer_id = $1 AND status = 'Confirmed'`,
      [userId]
    );

    // Pending payments made by user
    const { rows: [pendingRow] } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS "pendingPayments"
       FROM payment
       WHERE payer_id = $1 AND status = 'Pending'`,
      [userId]
    );

    const totalOwed = parseFloat(owedRow.totalOwed);
    const confirmedPayments = parseFloat(confirmedRow.confirmedPayments);
    const pendingPayments = parseFloat(pendingRow.pendingPayments);
    const currentBalance = totalOwed - confirmedPayments;

    return reply.send({
      totalOwed,
      confirmedPayments,
      pendingPayments,
      currentBalance: Math.max(0, currentBalance),
    });
  });

  /**
   * GET /dashboard/recent
   * Authenticated — returns recent expenses and payments for the current user
   */
  fastify.get('/dashboard/recent', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as { id: string };

    const { rows: recentExpenses } = await query(
      `SELECT e.id, e.title, e.total_amount AS "totalAmount", e.date, e.status,
              e.category_id AS "categoryId", e.creator_id AS "creatorId",
              c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor",
              (SELECT COUNT(*) FROM expense_participant WHERE expense_id = e.id) AS "participantCount",
              (SELECT amount_owed FROM expense_participant WHERE expense_id = e.id AND user_id = $1) AS "yourShare"
       FROM expense e
       JOIN category c ON c.id = e.category_id
       JOIN expense_participant ep ON ep.expense_id = e.id AND ep.user_id = $1
       ORDER BY e.date DESC
       LIMIT 5`,
      [userId]
    );

    const { rows: recentPayments } = await query(
      `SELECT p.id, p.date, p.amount, p.status, p.payer_id AS "payerId", p.payee_id AS "payeeId",
              payee.name AS "payeeName"
       FROM payment p
       JOIN "user" payee ON payee.id = p.payee_id
       WHERE p.payer_id = $1
       ORDER BY p.date DESC
       LIMIT 5`,
      [userId]
    );

    return reply.send({ recentExpenses, recentPayments });
  });
}