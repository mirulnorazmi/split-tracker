import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool.js';

export default async function dashboardRoutes(fastify: FastifyInstance) {
  /**
   * GET /dashboard/stats
   * Authenticated — returns the current user's balance overview
   */
  fastify.get('/dashboard/stats', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as { id: string };

    // 1. Total all-time one-off expense share assigned to user (excluding when user is host/creator)
    const { rows: [owedRow] } = await query(
      `SELECT COALESCE(SUM(ep.amount_owed), 0) AS "expenseOwed"
       FROM expense_participant ep
       JOIN expense e ON e.id = ep.expense_id
       WHERE ep.user_id = $1
         AND e.status = 'Confirmed'
         AND e.creator_id != ep.user_id`,
      [userId]
    );

    // 2. Total all-time recurring subscription share assigned to user (all active cycles up to current month, excluding when user is host/creator)
    const { rows: [recOwedRow] } = await query(
      `SELECT COALESCE(SUM(rci.amount_due), 0) AS "recurringOwed"
       FROM recurring_cycle_item rci
       JOIN recurring_cycle rc ON rc.id = rci.cycle_id
       JOIN recurring_expense re ON re.id = rc.recurring_expense_id
       WHERE rci.user_id = $1
         AND re.creator_id != rci.user_id
         AND rci.status IN ('Paid', 'Pending', 'Unpaid')
         AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')`,
      [userId]
    );

    // 3. Current unpaid balance for one-off expenses (calculated per expense minus confirmed payments applied)
    const { rows: [unpaidExpenseRow] } = await query(
      `SELECT COALESCE(SUM(
         GREATEST(0, ep.amount_owed - COALESCE(ep_paid.paid, 0))
       ), 0) AS "expenseBalanceDue"
       FROM expense_participant ep
       JOIN expense e ON e.id = ep.expense_id
       LEFT JOIN (
         SELECT epm.expense_id, SUM(epm.amount_applied) AS paid
         FROM expense_payment epm
         JOIN payment p ON p.id = epm.payment_id
         WHERE p.payer_id = $1 AND p.status = 'Confirmed'
         GROUP BY epm.expense_id
       ) ep_paid ON ep_paid.expense_id = ep.expense_id
       WHERE ep.user_id = $1
         AND e.status = 'Confirmed'
         AND e.creator_id != ep.user_id`,
      [userId]
    );

    // 4. Current unpaid balance for recurring subscription cycles (due up to current month)
    const { rows: [unpaidRecRow] } = await query(
      `SELECT COALESCE(SUM(rci.amount_due), 0) AS "recurringBalanceDue"
       FROM recurring_cycle_item rci
       JOIN recurring_cycle rc ON rc.id = rci.cycle_id
       JOIN recurring_expense re ON re.id = rc.recurring_expense_id
       WHERE rci.user_id = $1
         AND rci.status IN ('Unpaid', 'Pending')
         AND re.creator_id != rci.user_id
         AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')`,
      [userId]
    );

    // 5. Confirmed payments made by user
    const { rows: [confirmedRow] } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS "confirmedPayments"
       FROM payment
       WHERE payer_id = $1 AND status = 'Confirmed'`,
      [userId]
    );

    // 6. Pending payments made by user
    const { rows: [pendingRow] } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS "pendingPayments"
       FROM payment
       WHERE payer_id = $1 AND status = 'Pending'`,
      [userId]
    );

    // 7. Total uncollected from one-off expenses created by user (what other participants owe)
    const { rows: [uncollectedRow] } = await query(
      `SELECT COALESCE(SUM(ep.amount_owed), 0) AS "totalUncollected"
       FROM expense_participant ep
       JOIN expense e ON e.id = ep.expense_id
       WHERE e.creator_id = $1
         AND e.status = 'Confirmed'
         AND ep.user_id != e.creator_id`,
      [userId]
    );

    // 8. Total uncollected from recurring expenses created by user (up to current month)
    const { rows: [recUncollectedRow] } = await query(
      `SELECT COALESCE(SUM(rci.amount_due), 0) AS "recUncollected"
       FROM recurring_cycle_item rci
       JOIN recurring_cycle rc ON rc.id = rci.cycle_id
       JOIN recurring_expense re ON re.id = rc.recurring_expense_id
       WHERE re.creator_id = $1
         AND rci.user_id != re.creator_id
         AND rci.status IN ('Paid', 'Pending', 'Unpaid')
         AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')`,
      [userId]
    );

    // 9. Total collected — confirmed payments received by the current user as payee
    const { rows: [collectedRow] } = await query(
      `SELECT COALESCE(SUM(amount), 0) AS "totalCollected"
       FROM payment
       WHERE payee_id = $1 AND status = 'Confirmed'`,
      [userId]
    );

    const expenseOwed = parseFloat(owedRow?.expenseOwed || '0');
    const recurringOwed = parseFloat(recOwedRow?.recurringOwed || '0');
    const totalOwed = expenseOwed + recurringOwed;

    const expenseBalanceDue = parseFloat(unpaidExpenseRow?.expenseBalanceDue || '0');
    const recurringBalanceDue = parseFloat(unpaidRecRow?.recurringBalanceDue || '0');
    const currentBalance = expenseBalanceDue + recurringBalanceDue;

    const confirmedPayments = parseFloat(confirmedRow.confirmedPayments);
    const pendingPayments = parseFloat(pendingRow.pendingPayments);

    const totalUncollected = parseFloat(uncollectedRow?.totalUncollected || '0') + parseFloat(recUncollectedRow?.recUncollected || '0');
    const totalCollected = parseFloat(collectedRow?.totalCollected || '0');
    const outstandingFromOthers = totalUncollected - totalCollected;

    return reply.send({
      totalOwed,
      expenseOwed,
      recurringOwed,
      confirmedPayments,
      pendingPayments,
      currentBalance: Math.max(0, currentBalance),
      totalUncollected,
      totalCollected,
      outstandingFromOthers: Math.max(0, outstandingFromOthers),
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
       WHERE (e.status = 'Confirmed' OR e.creator_id = $1)
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const { rows: recentPayments } = await query(
      `SELECT p.id, p.date, p.amount, p.status, p.payer_id AS "payerId", p.payee_id AS "payeeId",
              payee.name AS "payeeName"
       FROM payment p
       JOIN "user" payee ON payee.id = p.payee_id
       WHERE p.payer_id = $1
       ORDER BY p.date DESC, p.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return reply.send({ recentExpenses, recentPayments });
  });

  /**
   * GET /admin/pending-counts
   * Authenticated — returns lightweight pending counts for badges without downloading full records
   */
  fastify.get('/admin/pending-counts', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };

    const { rows: [counts] } = await query(
      `SELECT
         (
           (CASE WHEN $1 = 'Admin' THEN (SELECT COUNT(*)::int FROM expense WHERE status = 'Pending') ELSE 0 END) +
           (SELECT COUNT(*)::int FROM payment WHERE status = 'Pending' AND payee_id = $2)
         ) AS "pendingApprovals",
         (CASE WHEN $1 = 'Admin' THEN (SELECT COUNT(*)::int FROM "user" WHERE status = 'Pending') ELSE 0 END) AS "pendingUsers"`,
      [role, userId]
    );

    return reply.send(counts || { pendingApprovals: 0, pendingUsers: 0 });
  });
}