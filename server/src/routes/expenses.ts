import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, getClient } from '../db/pool.js';

interface CreateExpenseBody {
  title: string;
  totalAmount: number;
  categoryId: string;
  participants: { userId: string; amountOwed: number }[];
}

interface UpdateStatusBody {
  status: 'Confirmed';
}

export default async function expenseRoutes(fastify: FastifyInstance) {
  /**
   * POST /expenses
   * Authenticated — create a new expense (status: Pending)
   */
  fastify.post('/expenses', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: creatorId } = request.user as { id: string };
    const { title, totalAmount, categoryId, participants } = request.body as CreateExpenseBody;

    if (!title || !totalAmount || !categoryId || !participants || participants.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'title, totalAmount, categoryId, and participants are required' });
    }

    // Validate total matches sum of participant amounts
    const sum = participants.reduce((acc, p) => acc + p.amountOwed, 0);
    if (Math.abs(sum - totalAmount) > 0.01) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Sum of participant amounts must equal totalAmount' });
    }

    const client = await query('BEGIN');
    try {
      const { rows: [expense] } = await query(
        `INSERT INTO expense (title, total_amount, category_id, creator_id, status)
         VALUES ($1, $2, $3, $4, 'Pending')
         RETURNING id, title, total_amount, date, category_id, creator_id, status, created_at`,
        [title, totalAmount, categoryId, creatorId]
      );

      for (const p of participants) {
        await query(
          `INSERT INTO expense_participant (expense_id, user_id, amount_owed) VALUES ($1, $2, $3)`,
          [expense.id, p.userId, p.amountOwed]
        );
      }

      await query('COMMIT');

      const { rows: [full] } = await query(
        `SELECT e.*, COALESCE(json_agg(json_build_object('userId', ep.user_id, 'amountOwed', ep.amount_owed)) FILTER (WHERE ep.user_id IS NOT NULL), '[]') AS participants
         FROM expense e
         LEFT JOIN expense_participant ep ON ep.expense_id = e.id
         WHERE e.id = $1
         GROUP BY e.id`,
        [expense.id]
      );

      return reply.status(201).send(full);
    } catch (err) {
      await query('ROLLBACK');
      throw err;
    }
  });

  /**
   * GET /expenses
   * Authenticated — list expenses with optional filters
   */
  fastify.get('/expenses', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { status, creatorId } = request.query as { status?: string; creatorId?: string };
    const params: any[] = [];
    const conditions: string[] = [];

    // Non-admins can only see Confirmed expenses, OR Pending expenses they personally created.
    // They cannot see pending expenses created by other users until approved by Admin.
    if (role !== 'Admin') {
      params.push(userId);
      conditions.push(`(e.status = 'Confirmed' OR e.creator_id = $${params.length})`);
    }

    if (status) {
      params.push(status);
      conditions.push(`e.status = $${params.length}`);
    }
    if (creatorId) {
      params.push(creatorId);
      conditions.push(`e.creator_id = $${params.length}`);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT e.id, e.title, e.total_amount AS "totalAmount", e.date, e.status,
              e.category_id AS "categoryId", e.creator_id AS "creatorId",
              e.approved_by AS "approvedById", approver.name AS "approvedByName", e.approved_at AS "approvedAt",
              c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor",
              COALESCE(json_agg(json_build_object('userId', ep.user_id, 'amountOwed', ep.amount_owed)) FILTER (WHERE ep.user_id IS NOT NULL), '[]') AS participants
       FROM expense e
       JOIN category c ON c.id = e.category_id
       LEFT JOIN "user" approver ON approver.id = e.approved_by
       LEFT JOIN expense_participant ep ON ep.expense_id = e.id
       ${where}
       GROUP BY e.id, c.id, approver.id
       ORDER BY e.date DESC`,
      params
    );

    return reply.send(rows);
  });

  /**
   * GET /expenses/:id
   * Authenticated — get expense details
   */
  fastify.get('/expenses/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };

    const { rows } = await query(
      `SELECT e.id, e.title, e.total_amount AS "totalAmount", e.date, e.status,
              e.category_id AS "categoryId", e.creator_id AS "creatorId",
              e.approved_by AS "approvedById", approver.name AS "approvedByName", e.approved_at AS "approvedAt",
              c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor",
              COALESCE(json_agg(json_build_object('userId', ep.user_id, 'amountOwed', ep.amount_owed)) FILTER (WHERE ep.user_id IS NOT NULL), '[]') AS participants
       FROM expense e
       JOIN category c ON c.id = e.category_id
       LEFT JOIN "user" approver ON approver.id = e.approved_by
       LEFT JOIN expense_participant ep ON ep.expense_id = e.id
       WHERE e.id = $1
       GROUP BY e.id, c.id, approver.id`,
      [id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Expense not found' });
    }

    const expense = rows[0];

    // Non-admins cannot view pending expenses created by someone else
    if (role !== 'Admin' && expense.status === 'Pending' && expense.creatorId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'This expense is pending administrator approval.' });
    }

    return reply.send(expense);
  });

  /**
   * PUT /expenses/:id
   * Authenticated — update an expense's details
   * Permitted for Admins or expense creator
   */
  fastify.put('/expenses/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };
    const { title, totalAmount, categoryId, participants } = request.body as Partial<CreateExpenseBody>;

    const { rows: existingRows } = await query('SELECT * FROM expense WHERE id = $1', [id]);
    if (existingRows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Expense not found' });
    }

    const existing = existingRows[0];
    if (role !== 'Admin' && existing.creator_id !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the creator or an admin can edit this expense' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const { rows: updatedRows } = await client.query(
        `UPDATE expense
         SET title = COALESCE($1, title),
             total_amount = COALESCE($2, total_amount),
             category_id = COALESCE($3, category_id),
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [title ?? null, totalAmount ?? null, categoryId ?? null, id]
      );

      if (participants && Array.isArray(participants) && participants.length > 0) {
        await client.query('DELETE FROM expense_participant WHERE expense_id = $1', [id]);
        for (const p of participants) {
          await client.query(
            'INSERT INTO expense_participant (expense_id, user_id, amount_owed) VALUES ($1, $2, $3)',
            [id, p.userId, p.amountOwed]
          );
        }
      }

      await client.query('COMMIT');
      return reply.send({ ...updatedRows[0], message: 'Expense updated successfully.' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  /**
   * PATCH | POST | GET /expenses/:id/status & /expenses/:id/approve
   * Authenticated — approve or confirm a pending expense
   * Permitted for Admins, expense creators, or expense participants
   */
  const handleUpdateExpenseStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };
    const body = (request.body as Partial<UpdateStatusBody>) || {};
    const queryParams = (request.query as { status?: string }) || {};
    const status = body.status || queryParams.status || 'Confirmed';

    if (!status || !['Confirmed'].includes(status)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'status must be "Confirmed"' });
    }

    // Only Admin can approve expenses
    if (role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only administrators can approve expenses' });
    }

    const { rows } = await query(
      `UPDATE expense
       SET status = $1, approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3 AND status = 'Pending'
       RETURNING id, status, approved_by AS "approvedById", approved_at AS "approvedAt"`,
      [status, userId, id]
    );

    if (rows.length === 0) {
      const { rows: existing } = await query(
        `SELECT e.id, e.status, e.approved_by AS "approvedById", approver.name AS "approvedByName", e.approved_at AS "approvedAt"
         FROM expense e
         LEFT JOIN "user" approver ON approver.id = e.approved_by
         WHERE e.id = $1`,
        [id]
      );
      if (existing.length > 0) {
        return reply.send({ ...existing[0], message: 'Expense is already confirmed.' });
      }
      return reply.status(404).send({ error: 'Not Found', message: 'Expense not found' });
    }

    const { rows: approverRows } = await query('SELECT name FROM "user" WHERE id = $1', [userId]);
    const approvedByName = approverRows[0]?.name || null;

    return reply.send({ ...rows[0], approvedByName, message: 'Expense status updated.' });
  };

  fastify.patch('/expenses/:id/status', { preHandler: [fastify.authenticate] }, handleUpdateExpenseStatus);
  fastify.post('/expenses/:id/status', { preHandler: [fastify.authenticate] }, handleUpdateExpenseStatus);
  fastify.get('/expenses/:id/status', { preHandler: [fastify.authenticate] }, handleUpdateExpenseStatus);
  fastify.patch('/expenses/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdateExpenseStatus);
  fastify.post('/expenses/:id/approve', { preHandler: [fastify.authenticate] }, handleUpdateExpenseStatus);
}