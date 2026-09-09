import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, getClient } from '../db/pool.js';

interface CreateFolderBody {
  name: string;
  description?: string;
  category?: string;
  color?: string;
}

interface UpdateFolderBody {
  name?: string;
  description?: string;
  category?: string;
  color?: string;
}

interface AttachExpensesBody {
  expenseIds: string[];
}

export default async function folderRoutes(fastify: FastifyInstance) {
  /**
   * POST /folders
   * Authenticated — create a new folder / group
   */
  fastify.post('/folders', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: userId } = request.user as { id: string };
    const { name, description = '', category = 'General', color = '#C9FF55' } = (request.body as CreateFolderBody) || {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Folder name is required' });
    }

    const { rows: [folder] } = await query(
      `INSERT INTO folder (name, description, category, color, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, description, category, color, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name.trim(), description?.trim() || null, category?.trim() || 'General', color || '#C9FF55', userId]
    );

    return reply.status(201).send(folder);
  });

  /**
   * GET /folders
   * Authenticated — list folders accessible to user with financial aggregate stats
   */
  fastify.get('/folders', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };

    const filterClause =
      role === 'Admin'
        ? ''
        : `WHERE f.created_by = $1
           OR EXISTS (
             SELECT 1 FROM expense e
             WHERE e.folder_id = f.id
               AND (e.creator_id = $1 OR EXISTS (
                 SELECT 1 FROM expense_participant ep WHERE ep.expense_id = e.id AND ep.user_id = $1
               ))
           )`;

    const params = role === 'Admin' ? [] : [userId];

    const { rows } = await query(
      `SELECT
         f.id,
         f.name,
         f.description,
         f.category,
         f.color,
         f.created_by AS "createdBy",
         creator.name AS "creatorName",
         f.created_at AS "createdAt",
         f.updated_at AS "updatedAt",
         COALESCE(
           (SELECT COUNT(*)::int FROM expense ex WHERE ex.folder_id = f.id),
           0
         ) AS "expenseCount",
         COALESCE(
           (SELECT SUM(ex.total_amount)::float FROM expense ex WHERE ex.folder_id = f.id),
           0
         ) AS "totalExpenses",
         COALESCE(
           (
             SELECT SUM(
               GREATEST(
                 0,
                 ep.amount_owed - COALESCE(
                   (
                     SELECT SUM(epm.amount_applied)
                     FROM expense_payment epm
                     JOIN payment p ON p.id = epm.payment_id
                     WHERE epm.expense_id = ex.id
                       AND p.payer_id = ep.user_id
                       AND p.status = 'Confirmed'
                   ),
                   0
                 )
               )
             )::float
             FROM expense ex
             JOIN expense_participant ep ON ep.expense_id = ex.id
             WHERE ex.folder_id = f.id
               AND ep.user_id != ex.creator_id
           ),
           0
         )::float AS "totalOutstanding",
         COALESCE(
           (
             SELECT json_agg(DISTINCT jsonb_build_object('id', u.id, 'name', u.name, 'avatar', u.avatar, 'initials', u.initials))
             FROM expense ex
             JOIN expense_participant ep ON ep.expense_id = ex.id
             JOIN "user" u ON u.id = ep.user_id
             WHERE ex.folder_id = f.id
           ),
           '[]'
         ) AS "participantsPreview"
       FROM folder f
       LEFT JOIN "user" creator ON creator.id = f.created_by
       ${filterClause}
       ORDER BY f.updated_at DESC`,
      params
    );

    const enriched = rows.map((r: any) => {
      const exp = Number(r.totalExpenses || 0);
      const out = Number(r.totalOutstanding || 0);
      const col = Math.max(0, Number((exp - out).toFixed(2)));
      return {
        ...r,
        totalExpenses: exp,
        totalOutstanding: out,
        totalCollected: col,
      };
    });

    return reply.send(enriched);
  });

  /**
   * GET /folders/:id
   * Authenticated — get folder details, expenses, and participant balance breakdown
   */
  fastify.get('/folders/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };

    const { rows: folderRows } = await query(
      `SELECT
         f.id,
         f.name,
         f.description,
         f.category,
         f.color,
         f.created_by AS "createdBy",
         creator.name AS "creatorName",
         f.created_at AS "createdAt",
         f.updated_at AS "updatedAt"
       FROM folder f
       LEFT JOIN "user" creator ON creator.id = f.created_by
       WHERE f.id = $1`,
      [id]
    );

    if (folderRows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    }

    const folder = folderRows[0];

    const expenseFilter = role === 'Admin'
      ? 'WHERE e.folder_id = $1'
      : `WHERE e.folder_id = $1 AND (e.status = 'Confirmed' OR e.creator_id = '${userId}')`;

    // Get all expenses in this folder
    const { rows: expenses } = await query(
      `SELECT
         e.id,
         e.title,
         e.total_amount AS "totalAmount",
         e.date,
         e.status,
         e.category_id AS "categoryId",
         e.creator_id AS "creatorId",
         c.name AS "categoryName",
         c.icon AS "categoryIcon",
         c.color AS "categoryColor",
         creator.name AS "creatorName",
         COALESCE(
           json_agg(
             json_build_object('userId', ep.user_id, 'amountOwed', ep.amount_owed)
           ) FILTER (WHERE ep.user_id IS NOT NULL),
           '[]'
         ) AS participants
       FROM expense e
       JOIN category c ON c.id = e.category_id
       JOIN "user" creator ON creator.id = e.creator_id
       LEFT JOIN expense_participant ep ON ep.expense_id = e.id
       ${expenseFilter}
       GROUP BY e.id, c.id, creator.name
       ORDER BY e.date DESC`,
      [id]
    );

    // Get all payments related to expenses in this folder
    const { rows: payments } = await query(
      `SELECT
         p.id,
         p.date,
         p.amount,
         p.payer_id AS "payerId",
         p.payee_id AS "payeeId",
         p.status,
         epm.expense_id AS "expenseId",
         epm.amount_applied AS "amountApplied"
       FROM payment p
       JOIN expense_payment epm ON epm.payment_id = p.id
       JOIN expense e ON e.id = epm.expense_id
       WHERE e.folder_id = $1`,
      [id]
    );

    // Get unique participants in this folder
    const { rows: users } = await query(
      `SELECT DISTINCT
         u.id,
         u.name,
         u.email,
         u.avatar,
         u.initials
       FROM "user" u
       WHERE u.id IN (
         SELECT ep.user_id FROM expense_participant ep JOIN expense e ON e.id = ep.expense_id WHERE e.folder_id = $1
         UNION
         SELECT e.creator_id FROM expense e WHERE e.folder_id = $1
       )`,
      [id]
    );

    // Per-participant summary
    const participantSummary = users.map((u: any) => {
      let totalShare = 0;
      let totalPaid = 0;
      let remainingOwed = 0;

      expenses.forEach((e: any) => {
        const p = (e.participants || []).find((part: any) => part.userId === u.id);
        const share = p ? Number(p.amountOwed || 0) : 0;
        totalShare += share;

        if (e.creatorId === u.id) {
          // User is the host who paid for this expense upfront!
          totalPaid += share;
        } else {
          const userPayments = payments
            .filter((pm: any) => pm.payerId === u.id && pm.expenseId === e.id && pm.status === 'Confirmed')
            .reduce((sum: number, pm: any) => sum + Number(pm.amountApplied || 0), 0);
          totalPaid += userPayments;
          remainingOwed += Math.max(0, share - userPayments);
        }
      });

      remainingOwed = Math.max(0, Number(remainingOwed.toFixed(2)));
      const isSettled = remainingOwed <= 0.01;
      const isHost = expenses.some((e: any) => e.creatorId === u.id);

      return {
        userId: u.id,
        name: u.name,
        avatar: u.avatar,
        initials: u.initials,
        email: u.email,
        totalShare: Number(totalShare.toFixed(2)),
        totalPaid: Number(totalPaid.toFixed(2)),
        remainingOwed,
        status: isSettled ? 'SETTLED' : 'PENDING',
        isHost,
      };
    });

    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + Number(e.totalAmount || 0), 0);
    const totalOutstanding = Math.max(
      0,
      Number(participantSummary.reduce((sum: number, p: any) => sum + p.remainingOwed, 0).toFixed(2))
    );
    const totalCollected = Math.max(0, Number((totalExpenses - totalOutstanding).toFixed(2)));

    return reply.send({
      ...folder,
      expenses,
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalCollected: Number(totalCollected.toFixed(2)),
      totalOutstanding: Number(totalOutstanding.toFixed(2)),
      participantSummary,
    });
  });

  /**
   * PUT /folders/:id
   * Authenticated — update folder details (creator or Admin)
   */
  fastify.put('/folders/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };
    const { name, description, category, color } = (request.body as UpdateFolderBody) || {};

    const { rows: existing } = await query('SELECT * FROM folder WHERE id = $1', [id]);
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    }

    if (role !== 'Admin' && existing[0].created_by !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the creator or an admin can update this folder' });
    }

    const { rows: [updated] } = await query(
      `UPDATE folder
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           color = COALESCE($4, color),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, description, category, color, created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name?.trim() ?? null, description?.trim() ?? null, category?.trim() ?? null, color ?? null, id]
    );

    return reply.send(updated);
  });

  /**
   * DELETE /folders/:id
   * Authenticated — delete a folder (expenses remain intact with folder_id = NULL)
   */
  fastify.delete('/folders/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };

    const { rows: existing } = await query('SELECT * FROM folder WHERE id = $1', [id]);
    if (existing.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    }

    if (role !== 'Admin' && existing[0].created_by !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the creator or an admin can delete this folder' });
    }

    // Clear folder_id on expenses explicitly before delete
    await query('UPDATE expense SET folder_id = NULL WHERE folder_id = $1', [id]);
    await query('DELETE FROM folder WHERE id = $1', [id]);

    return reply.send({ message: 'Folder deleted successfully. Associated expenses were retained as standalone items.', id });
  });

  /**
   * POST /folders/:id/expenses
   * Authenticated — attach existing expenses to a folder
   */
  fastify.post('/folders/:id/expenses', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };
    const { expenseIds } = request.body as AttachExpensesBody;

    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'expenseIds array is required' });
    }

    const { rows: folderRows } = await query('SELECT id, created_by AS "createdBy" FROM folder WHERE id = $1', [id]);
    if (folderRows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    }

    // Rule: Only the folder creator (or Admin) can add/attach expenses into the folder
    if (role !== 'Admin' && folderRows[0].createdBy !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the folder owner can attach expenses to this folder' });
    }

    // Rule: The folder owner can attach only their own expenses, not expenses created by other people
    const { rows: expenseRows } = await query(
      'SELECT id, creator_id AS "creatorId" FROM expense WHERE id = ANY($1)',
      [expenseIds]
    );

    if (role !== 'Admin') {
      const notOwned = expenseRows.filter((e: any) => e.creatorId !== userId);
      if (notOwned.length > 0) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only attach your own expenses to this folder.',
        });
      }
    }

    await query(
      `UPDATE expense
       SET folder_id = $1, updated_at = NOW()
       WHERE id = ANY($2)`,
      [id, expenseIds]
    );

    await query('UPDATE folder SET updated_at = NOW() WHERE id = $1', [id]);

    return reply.send({ message: `${expenseIds.length} expense(s) attached to folder successfully.` });
  });

  /**
   * DELETE /folders/:id/expenses/:expenseId
   * Authenticated — remove an expense from a folder (makes it standalone)
   */
  fastify.delete('/folders/:id/expenses/:expenseId', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id, expenseId } = request.params as { id: string; expenseId: string };

    const { rows: folderRows } = await query('SELECT id, created_by AS "createdBy" FROM folder WHERE id = $1', [id]);
    if (folderRows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Folder not found' });
    }

    // Rule: Only the folder creator (or Admin) can detach expenses
    if (role !== 'Admin' && folderRows[0].createdBy !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only the folder owner can remove expenses from this folder' });
    }

    const { rows } = await query(
      `UPDATE expense
       SET folder_id = NULL, updated_at = NOW()
       WHERE id = $1 AND folder_id = $2
       RETURNING id`,
      [expenseId, id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Expense not found in this folder' });
    }

    await query('UPDATE folder SET updated_at = NOW() WHERE id = $1', [id]);

    return reply.send({ message: 'Expense removed from folder successfully.' });
  });
}
