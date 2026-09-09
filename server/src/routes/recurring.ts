import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool.js';

interface ParticipantInput {
  userId: string;
  amount?: number;
  joinedDate?: string;
  discontinuedDate?: string | null;
  paidUntil?: string | null;
}

interface CreateRecurringBody {
  title: string;
  totalAmount: number;
  categoryId: string;
  startDate?: string;
  billingCycle?: 'monthly' | 'yearly';
  billingDay?: number;
  splitType?: 'equal' | 'custom';
  participants: ParticipantInput[];
}

interface UpdateRecurringBody {
  title?: string;
  totalAmount?: number;
  categoryId?: string;
  startDate?: string;
  billingCycle?: 'monthly' | 'yearly';
  billingDay?: number;
  splitType?: 'equal' | 'custom';
  status?: 'active' | 'paused' | 'cancelled';
  participants?: ParticipantInput[];
}

export default async function recurringRoutes(fastify: FastifyInstance) {
  /**
   * Helper: Ensure a cycle exists for a given period (YYYY-MM) and populate items
   */
  async function ensureCycle(recurringExpenseId: string, periodKey: string) {
    const { rows: expRows } = await query(
      'SELECT id, total_amount, billing_day, split_type, creator_id, start_date FROM recurring_expense WHERE id = $1',
      [recurringExpenseId]
    );
    if (expRows.length === 0) return null;
    const exp = expRows[0];

    // Don't create cycles before the subscription started
    const expStartDate = new Date(exp.start_date);
    const expStartPeriod = `${expStartDate.getFullYear()}-${String(expStartDate.getMonth() + 1).padStart(2, '0')}`;
    if (periodKey < expStartPeriod) {
      return null;
    }

    // Check if cycle already exists
    const { rows: cycleRows } = await query(
      'SELECT * FROM recurring_cycle WHERE recurring_expense_id = $1 AND period_key = $2',
      [recurringExpenseId, periodKey]
    );

    let cycleId = cycleRows[0]?.id;
    if (!cycleId) {
      const [year, month] = periodKey.split('-').map(Number);
      const dueDate = new Date(Date.UTC(year, month - 1, Math.min(exp.billing_day || 1, 28)));

      const { rows: newCycle } = await query(
        `INSERT INTO recurring_cycle (recurring_expense_id, period_key, due_date, total_amount, status)
         VALUES ($1, $2, $3, $4, 'Open')
         RETURNING id`,
        [recurringExpenseId, periodKey, dueDate.toISOString().split('T')[0], exp.total_amount]
      );
      cycleId = newCycle[0].id;
    }

    // Get active participants for this period
    // Active if joined_date <= end of period AND (discontinued_date IS NULL OR discontinued_date >= start of period)
    const [year, month] = periodKey.split('-').map(Number);
    const startOfPeriod = new Date(Date.UTC(year, month - 1, 1));
    const endOfPeriod = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const { rows: activeParts } = await query(
      `SELECT rp.user_id, rp.amount, rp.is_active
       FROM recurring_participant rp
       WHERE rp.recurring_expense_id = $1
         AND rp.joined_date <= $2
         AND (rp.discontinued_date IS NULL OR rp.discontinued_date >= $3)`,
      [recurringExpenseId, endOfPeriod, startOfPeriod]
    );

    if (activeParts.length === 0) {
      return cycleId;
    }

    const count = activeParts.length;
    const equalShare = count > 0 ? Number((Number(exp.total_amount) / count).toFixed(2)) : 0;

    // Delete Unpaid cycle items for users who are no longer active this period
    const activeUserIds = activeParts.map((p: any) => p.user_id);
    if (activeUserIds.length > 0) {
      await query(
        `DELETE FROM recurring_cycle_item
         WHERE cycle_id = $1 AND status = 'Unpaid' AND user_id != ALL($2::uuid[])`,
        [cycleId, activeUserIds]
      );
    } else {
      await query(
        `DELETE FROM recurring_cycle_item
         WHERE cycle_id = $1 AND status = 'Unpaid'`,
        [cycleId]
      );
    }

    for (const p of activeParts) {
      const amountDue = exp.split_type === 'custom' && Number(p.amount) > 0 ? Number(p.amount) : equalShare;
      const isCreator = p.user_id === exp.creator_id;
      const initialStatus = isCreator ? 'Waived' : 'Unpaid';

      await query(
        `INSERT INTO recurring_cycle_item (cycle_id, user_id, amount_due, status, paid_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (cycle_id, user_id) 
         DO UPDATE SET amount_due = EXCLUDED.amount_due WHERE recurring_cycle_item.status = 'Unpaid'`,
        [cycleId, p.user_id, amountDue, initialStatus, isCreator ? new Date() : null]
      );
    }

    return cycleId;
  }

  /**
   * GET /recurring
   * List all recurring subscriptions for current user
   */
  fastify.get('/recurring', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };

    const { rows } = await query(
      `SELECT re.id, re.title, re.total_amount AS "totalAmount", re.billing_cycle AS "billingCycle",
              re.billing_day AS "billingDay", re.split_type AS "splitType", re.status,
              re.start_date AS "startDate", re.created_at AS "createdAt",
              re.category_id AS "categoryId", c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor",
              re.creator_id AS "creatorId", creator.name AS "creatorName",
              (SELECT COUNT(*) FROM recurring_participant WHERE recurring_expense_id = re.id AND is_active = true) AS "activeParticipantsCount",
              (SELECT amount FROM recurring_participant WHERE recurring_expense_id = re.id AND user_id = $1) AS "yourShare",
              EXISTS (SELECT 1 FROM recurring_participant WHERE recurring_expense_id = re.id AND user_id = $1 AND is_active = true) AS "isParticipant",
              COALESCE((
                SELECT SUM(rci.amount_due)
                FROM recurring_cycle_item rci
                JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                WHERE rc.recurring_expense_id = re.id
                  AND rci.user_id = $1
                  AND rci.status = 'Unpaid'
                  AND re.creator_id != $1
                  AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')
              ), 0) AS "yourTotalUnpaid",
              COALESCE((
                SELECT COUNT(*)
                FROM recurring_cycle_item rci
                JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                WHERE rc.recurring_expense_id = re.id
                  AND rci.user_id = $1
                  AND rci.status = 'Unpaid'
                  AND re.creator_id != $1
                  AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')
              ), 0) AS "yourUnpaidMonthsCount",
              COALESCE((
                SELECT SUM(rci.amount_due)
                FROM recurring_cycle_item rci
                JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                WHERE rc.recurring_expense_id = re.id
                  AND rci.user_id = $1
                  AND rci.status = 'Pending'
                  AND re.creator_id != $1
                  AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')
              ), 0) AS "yourTotalPending",
              COALESCE((
                SELECT COUNT(*)
                FROM recurring_cycle_item rci
                JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                WHERE rc.recurring_expense_id = re.id
                  AND rci.user_id = $1
                  AND rci.status = 'Pending'
                  AND re.creator_id != $1
                  AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')
              ), 0) AS "yourPendingMonthsCount"
       FROM recurring_expense re
       JOIN category c ON c.id = re.category_id
       JOIN "user" creator ON creator.id = re.creator_id
       WHERE re.creator_id = $1
          OR EXISTS (SELECT 1 FROM recurring_participant rp WHERE rp.recurring_expense_id = re.id AND rp.user_id = $1)
       ORDER BY re.created_at DESC`,
      [userId]
    );

    return reply.send(rows);
  });

  /**
   * POST /recurring
   * Create a new recurring subscription
   */
  fastify.post('/recurring', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: creatorId } = request.user as { id: string };
    const {
      title,
      totalAmount,
      categoryId,
      startDate,
      billingCycle = 'monthly',
      billingDay = 1,
      splitType = 'equal',
      participants = [],
    } = request.body as CreateRecurringBody;

    if (!title || !totalAmount || !categoryId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'title, totalAmount, and categoryId are required' });
    }

    const validStartDate = startDate ? new Date(startDate) : new Date();

    // Ensure creator is included in participant list
    const participantMap = new Map<string, ParticipantInput>();
    for (const p of participants) {
      participantMap.set(p.userId, p);
    }
    if (!participantMap.has(creatorId)) {
      participantMap.set(creatorId, { userId: creatorId });
    }

    const participantCount = participantMap.size;
    const equalShare = Number((totalAmount / participantCount).toFixed(2));

    const { rows: newRec } = await query(
      `INSERT INTO recurring_expense (title, total_amount, category_id, creator_id, billing_cycle, billing_day, split_type, status, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8)
       RETURNING id, title, total_amount AS "totalAmount", billing_cycle AS "billingCycle", billing_day AS "billingDay", start_date AS "startDate"`,
      [title, totalAmount, categoryId, creatorId, billingCycle, billingDay, splitType, validStartDate]
    );

    const recurringId = newRec[0].id;

    // Insert participants with historical joined/discontinued dates
    for (const [userId, pInput] of participantMap.entries()) {
      const share = splitType === 'custom' && (pInput.amount || 0) > 0 ? (pInput.amount || 0) : equalShare;
      const joinedDate = pInput.joinedDate ? new Date(pInput.joinedDate) : validStartDate;
      const discontinuedDate = pInput.discontinuedDate ? new Date(pInput.discontinuedDate) : null;
      const isActive = !discontinuedDate;

      await query(
        `INSERT INTO recurring_participant (recurring_expense_id, user_id, amount, joined_date, discontinued_date, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [recurringId, userId, share, joinedDate, discontinuedDate, isActive]
      );
    }

    // Backfill and generate cycles from startDate up to current month (or latest paidUntil)
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startPeriod = `${validStartDate.getFullYear()}-${String(validStartDate.getMonth() + 1).padStart(2, '0')}`;

    let maxPeriod = currentPeriod;
    for (const p of participants) {
      if (p.paidUntil && p.paidUntil > maxPeriod) {
        maxPeriod = p.paidUntil;
      }
    }

    let [curY, curM] = startPeriod.split('-').map(Number);
    const [endY, endM] = maxPeriod.split('-').map(Number);

    while (curY < endY || (curY === endY && curM <= endM)) {
      const periodKey = `${curY}-${String(curM).padStart(2, '0')}`;
      const cycleId = await ensureCycle(recurringId, periodKey);

      if (cycleId) {
        // Mark items as Paid if participant specified paidUntil >= periodKey
        for (const p of participants) {
          if (p.paidUntil && periodKey <= p.paidUntil && p.userId !== creatorId) {
            await query(
              `UPDATE recurring_cycle_item
               SET status = 'Paid', paid_at = NOW()
               WHERE cycle_id = $1 AND user_id = $2 AND status != 'Waived'`,
              [cycleId, p.userId]
            );
          }
        }

        // Auto-settle cycle if all cycle items are Paid or Waived
        await query(
          `UPDATE recurring_cycle
           SET status = 'Settled'
           WHERE id = $1
             AND NOT EXISTS (
               SELECT 1 FROM recurring_cycle_item
               WHERE cycle_id = $1 AND status IN ('Unpaid', 'Pending')
             )`,
          [cycleId]
        );
      }

      curM++;
      if (curM > 12) {
        curY++;
        curM = 1;
      }
    }

    return reply.status(201).send({ ...newRec[0], message: 'Recurring expense created successfully' });
  });

  /**
   * GET /recurring/:id
   * Get recurring expense details with participants and personal dues summary
   */
  fastify.get('/recurring/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { id: reqUserId } = request.user as { id: string };

    const { rows } = await query(
      `SELECT re.id, re.title, re.total_amount AS "totalAmount", re.billing_cycle AS "billingCycle",
              re.billing_day AS "billingDay", re.split_type AS "splitType", re.status,
              re.start_date AS "startDate", re.created_at AS "createdAt",
              re.category_id AS "categoryId", c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor",
              re.creator_id AS "creatorId", creator.name AS "creatorName"
       FROM recurring_expense re
       JOIN category c ON c.id = re.category_id
       JOIN "user" creator ON creator.id = re.creator_id
       WHERE re.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Recurring expense not found' });
    }

    const rec = rows[0];

    // Fetch participants with user info and their specific unpaid dues for this subscription
    const { rows: participants } = await query(
      `SELECT rp.id, rp.user_id AS "userId", rp.amount, rp.joined_date AS "joinedDate",
              rp.discontinued_date AS "discontinuedDate", rp.is_active AS "isActive",
              u.name, u.email, u.avatar, u.initials,
              COALESCE((
                SELECT SUM(rci.amount_due)
                FROM recurring_cycle_item rci
                JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                WHERE rc.recurring_expense_id = $1
                  AND rci.user_id = rp.user_id
                  AND rci.status = 'Unpaid'
                  AND re.creator_id != rp.user_id
                  AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')
              ), 0) AS "totalUnpaid",
              COALESCE((
                SELECT COUNT(*)
                FROM recurring_cycle_item rci
                JOIN recurring_cycle rc ON rc.id = rci.cycle_id
                WHERE rc.recurring_expense_id = $1
                  AND rci.user_id = rp.user_id
                  AND rci.status = 'Unpaid'
                  AND re.creator_id != rp.user_id
                  AND rc.period_key <= TO_CHAR(NOW(), 'YYYY-MM')
              ), 0) AS "unpaidMonthsCount"
       FROM recurring_participant rp
       JOIN recurring_expense re ON re.id = rp.recurring_expense_id
       JOIN "user" u ON u.id = rp.user_id
       WHERE rp.recurring_expense_id = $1
       ORDER BY rp.is_active DESC, rp.joined_date ASC`,
      [id]
    );

    const activeParticipants = participants.filter((p) => p.isActive);
    const activeCount = activeParticipants.length;
    const currentEqualShare = activeCount > 0 ? Number((Number(rec.totalAmount) / activeCount).toFixed(2)) : 0;

    // Fetch unpaid cycles for current user
    const { rows: userUnpaidRows } = await query(
      `SELECT rci.id AS "itemId", rc.period_key AS "periodKey", rci.amount_due AS "amountDue", rc.due_date AS "dueDate"
       FROM recurring_cycle_item rci
       JOIN recurring_cycle rc ON rc.id = rci.cycle_id
       JOIN recurring_expense re ON re.id = rc.recurring_expense_id
       WHERE rc.recurring_expense_id = $1
         AND rci.user_id = $2
         AND rci.status = 'Unpaid'
         AND re.creator_id != $2
       ORDER BY rc.period_key ASC`,
      [id, reqUserId]
    );

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const unpaidCycles = userUnpaidRows.map((r: any) => {
      const [y, m] = r.periodKey.split('-').map(Number);
      return {
        itemId: r.itemId,
        periodKey: r.periodKey,
        month: m,
        year: y,
        monthName: monthNames[m - 1] || `Month ${m}`,
        amountDue: parseFloat(r.amountDue),
        dueDate: r.dueDate,
      };
    });

    // Total paid by requesting user
    const { rows: [paidRow] } = await query(
      `SELECT COALESCE(SUM(rci.amount_due), 0) AS "totalPaid"
       FROM recurring_cycle_item rci
       JOIN recurring_cycle rc ON rc.id = rci.cycle_id
       WHERE rc.recurring_expense_id = $1
         AND rci.user_id = $2
         AND rci.status = 'Paid'`,
      [id, reqUserId]
    );

    const isHost = rec.creatorId === reqUserId;
    const isParticipant = participants.some((p) => p.userId === reqUserId);
    const userPart = participants.find((p) => p.userId === reqUserId);
    const currentMonthlyShare = rec.splitType === 'custom' && userPart && userPart.amount > 0 ? parseFloat(userPart.amount) : currentEqualShare;

    // For host: total uncollected from other participants
    let totalUncollected = 0;
    const uncollectedParticipants: any[] = [];
    if (isHost) {
      for (const p of participants) {
        if (p.userId !== reqUserId && parseFloat(p.totalUnpaid) > 0) {
          totalUncollected += parseFloat(p.totalUnpaid);
          uncollectedParticipants.push({
            userId: p.userId,
            name: p.name,
            avatar: p.avatar,
            initials: p.initials,
            totalUnpaid: parseFloat(p.totalUnpaid),
            unpaidMonthsCount: parseInt(p.unpaidMonthsCount, 10),
          });
        }
      }
    }

    const now = new Date();
    const currentPeriodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentUnpaidCycles = unpaidCycles.filter(c => c.periodKey <= currentPeriodKey);
    const totalUnpaid = currentUnpaidCycles.reduce((sum, c) => sum + c.amountDue, 0);

    const userSummary = {
      isHost,
      isParticipant,
      currentMonthlyShare,
      totalUnpaid,
      unpaidCyclesCount: currentUnpaidCycles.length,
      unpaidCycles, // send all, including future, so user can optionally pay them
      totalPaid: parseFloat(paidRow?.totalPaid || '0'),
      totalUncollected: isHost ? totalUncollected : undefined,
      uncollectedParticipants: isHost ? uncollectedParticipants : undefined,
    };

    return reply.send({ ...rec, currentEqualShare, participants, userSummary });
  });

  /**
   * GET /recurring/:id/cycles?year=YYYY
   * Returns all 12 monthly cycles for a specific year formatted for the GitHub contribution heatmap
   */
  fastify.get('/recurring/:id/cycles', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { year: yearQuery } = request.query as { year?: string };
    const year = parseInt(yearQuery || String(new Date().getFullYear()), 10);

    const { rows: expRows } = await query(
      'SELECT start_date AS "startDate" FROM recurring_expense WHERE id = $1',
      [id]
    );
    const expStartDate = expRows[0]?.startDate ? new Date(expRows[0].startDate) : new Date();
    const expStartPeriod = `${expStartDate.getFullYear()}-${String(expStartDate.getMonth() + 1).padStart(2, '0')}`;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Ensure all 12 cycles exist for the year (allows paying in advance)
    const maxMonth = year <= currentYear ? 12 : 0;
    for (let m = 1; m <= maxMonth; m++) {
      const periodKey = `${year}-${String(m).padStart(2, '0')}`;
      if (periodKey >= expStartPeriod) {
        await ensureCycle(id, periodKey);
      }
    }

    // Fetch all cycles for this year
    const yearPrefix = `${year}-%`;
    const { rows: cycles } = await query(
      `SELECT rc.id, rc.period_key AS "periodKey", rc.due_date AS "dueDate",
              rc.total_amount AS "totalAmount", rc.status,
              COALESCE(json_agg(
                json_build_object(
                  'itemId', rci.id,
                  'userId', rci.user_id,
                  'name', u.name,
                  'avatar', u.avatar,
                  'initials', u.initials,
                  'amountDue', rci.amount_due,
                  'status', rci.status,
                  'paidAt', rci.paid_at
                ) ORDER BY rci.amount_due DESC
              ) FILTER (WHERE rci.id IS NOT NULL), '[]') AS items
       FROM recurring_cycle rc
       LEFT JOIN recurring_cycle_item rci ON rci.cycle_id = rc.id
       LEFT JOIN "user" u ON u.id = rci.user_id
       WHERE rc.recurring_expense_id = $1 AND rc.period_key LIKE $2
       GROUP BY rc.id
       ORDER BY rc.period_key ASC`,
      [id, yearPrefix]
    );

    // Build 12-month heatmap matrix
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthsData = [];

    for (let m = 1; m <= 12; m++) {
      const pKey = `${year}-${String(m).padStart(2, '0')}`;
      const foundCycle = cycles.find((c) => c.periodKey === pKey);
      const isBeforeStart = pKey < expStartPeriod;
      const isPastOrCurrent = !isBeforeStart && (year < currentYear || (year === currentYear && m <= currentMonth));

      let totalDue = 0;
      let totalCollected = 0;
      let paidCount = 0;
      let totalCount = 0;
      let items: any[] = [];

      if (foundCycle) {
        items = foundCycle.items || [];
        totalCount = items.length;
        for (const item of items) {
          totalDue += Number(item.amountDue);
          if (item.status === 'Paid' || item.status === 'Waived') {
            totalCollected += Number(item.amountDue);
            paidCount++;
          }
        }
      }

      // Heatmap level: 0 = not generated/future/inactive, 1 = unpaid, 2 = partial, 3 = fully settled
      let level = 0;
      if (foundCycle) {
        if (totalCount > 0 && paidCount === totalCount) {
          level = 3; // Bright Green (Fully settled)
        } else if (paidCount > 0) {
          level = 2; // Medium Green (Partially settled)
        } else {
          level = 1; // Amber/Light (Unpaid)
        }
      } else if (isBeforeStart) {
        level = 0; // Not active yet
      } else if (!isPastOrCurrent) {
        level = 0; // Future month
      }

      monthsData.push({
        month: m,
        monthName: monthNames[m - 1],
        periodKey: pKey,
        isFuture: !isPastOrCurrent && !isBeforeStart,
        cycleId: foundCycle?.id || null,
        totalDue,
        totalCollected,
        paidCount,
        totalCount,
        level,
        status: foundCycle?.status || (isBeforeStart ? 'Inactive' : isPastOrCurrent ? 'Open' : 'Future'),
        items,
      });
    }

    return reply.send({
      year,
      cycles: monthsData,
    });
  });

  /**
   * POST /recurring/:id/participants/:userId/discontinue
   * Mark a participant as discontinued and optionally recalculate active shares
   */
  /**
   * DELETE /recurring/:id/participants/:userId
   * Remove a participant entirely and recalculate cycles.
   */
  fastify.delete('/recurring/:id/participants/:userId', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, userId } = request.params as { id: string; userId: string };

    const { rows: check } = await query(
      'SELECT id, total_amount, split_type FROM recurring_expense WHERE id = $1',
      [id]
    );
    if (check.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Recurring expense not found' });
    }

    // Delete all cycle items for this user in this subscription
    await query(
      `DELETE FROM recurring_cycle_item rci
       USING recurring_cycle rc
       WHERE rci.cycle_id = rc.id
         AND rc.recurring_expense_id = $1
         AND rci.user_id = $2`,
      [id, userId]
    );

    // Delete the participant record entirely
    await query(
      `DELETE FROM recurring_participant WHERE recurring_expense_id = $1 AND user_id = $2`,
      [id, userId]
    );

    const exp = check[0];
    if (exp.split_type === 'equal') {
      const { rows: activeRows } = await query(
        'SELECT id FROM recurring_participant WHERE recurring_expense_id = $1 AND is_active = true',
        [id]
      );
      if (activeRows.length > 0) {
        const newShare = Number((Number(exp.total_amount) / activeRows.length).toFixed(2));
        await query(
          'UPDATE recurring_participant SET amount = $1 WHERE recurring_expense_id = $2 AND is_active = true',
          [newShare, id]
        );
      }
    }

    // Recalculate open cycles using ensureCycle logic
    const { rows: openCycles } = await query(`SELECT period_key FROM recurring_cycle WHERE recurring_expense_id = $1 AND status = 'Open'`, [id]);
    for (const c of openCycles) {
      await ensureCycle(id, c.period_key);
    }

    return reply.send({ message: 'Participant completely removed.' });
  });
  fastify.post('/recurring/:id/participants/:userId/discontinue', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, userId } = request.params as { id: string; userId: string };

    const { rows: check } = await query(
      'SELECT id, creator_id, total_amount, split_type FROM recurring_expense WHERE id = $1',
      [id]
    );
    if (check.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Recurring expense not found' });
    }

    const body = (request.body || {}) as { discontinuedDate?: string };
    const discontinuedAt = body.discontinuedDate ? new Date(body.discontinuedDate) : new Date();

    // Set discontinued date and mark inactive
    await query(
      `UPDATE recurring_participant
       SET is_active = false, discontinued_date = $1
       WHERE recurring_expense_id = $2 AND user_id = $3`,
      [discontinuedAt, id, userId]
    );

    // Delete cycle items for cycles strictly after the discontinuation month
    const disPeriod = `${discontinuedAt.getFullYear()}-${String(discontinuedAt.getMonth() + 1).padStart(2, '0')}`;
    await query(
      `DELETE FROM recurring_cycle_item rci
       USING recurring_cycle rc
       WHERE rci.cycle_id = rc.id
         AND rc.recurring_expense_id = $1
         AND rc.period_key > $2
         AND rci.user_id = $3`,
      [id, disPeriod, userId]
    );

    // If split is equal, recalculate remaining active participants' shares
    const exp = check[0];
    if (exp.split_type === 'equal') {
      const { rows: activeRows } = await query(
        'SELECT id FROM recurring_participant WHERE recurring_expense_id = $1 AND is_active = true',
        [id]
      );
      if (activeRows.length > 0) {
        const newShare = Number((Number(exp.total_amount) / activeRows.length).toFixed(2));
        await query(
          'UPDATE recurring_participant SET amount = $1 WHERE recurring_expense_id = $2 AND is_active = true',
          [newShare, id]
        );

        // Update amount_due on remaining open cycles after the discontinuation month
        await query(
          `UPDATE recurring_cycle_item rci
           SET amount_due = $1
           FROM recurring_cycle rc
           WHERE rci.cycle_id = rc.id
             AND rc.recurring_expense_id = $2
             AND rc.period_key > $3`,
          [newShare, id, disPeriod]
        );
      }
    }

    return reply.send({ message: 'Participant discontinued successfully and active shares updated.' });
  });

  /**
   * POST /recurring/:id/participants
   * Add a new participant to a recurring expense
   */
  fastify.post('/recurring/:id/participants', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { userId, amount, joinedDate } = request.body as { userId: string; amount?: number; joinedDate?: string };

    const { rows: check } = await query(
      'SELECT id, total_amount, split_type FROM recurring_expense WHERE id = $1',
      [id]
    );
    if (check.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Recurring expense not found' });
    }

    const exp = check[0];
    const jDate = joinedDate ? new Date(joinedDate) : new Date();

    await query(
      `INSERT INTO recurring_participant (recurring_expense_id, user_id, amount, is_active, joined_date, discontinued_date)
       VALUES ($1, $2, $3, true, $4, NULL)
       ON CONFLICT (recurring_expense_id, user_id)
       DO UPDATE SET is_active = true, discontinued_date = NULL, joined_date = $4`,
      [id, userId, amount || 0, jDate]
    );

    if (exp.split_type === 'equal') {
      const { rows: activeRows } = await query(
        'SELECT id FROM recurring_participant WHERE recurring_expense_id = $1 AND is_active = true',
        [id]
      );
      if (activeRows.length > 0) {
        const newShare = Number((Number(exp.total_amount) / activeRows.length).toFixed(2));
        await query(
          'UPDATE recurring_participant SET amount = $1 WHERE recurring_expense_id = $2 AND is_active = true',
          [newShare, id]
        );
      }
    }

    // Recalculate Open Cycles
    const { rows: openCycles } = await query(`SELECT period_key FROM recurring_cycle WHERE recurring_expense_id = $1 AND status = 'Open'`, [id]);
    for (const c of openCycles) {
      await ensureCycle(id, c.period_key);
    }

    return reply.send({ message: 'Participant added successfully.' });
  });

  /**
   * PATCH /recurring/cycle-items/:itemId/status
   * Toggle or update a participant's payment status for a specific month/cycle
   */
  fastify.patch('/recurring/cycle-items/:itemId/status', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { itemId } = request.params as { itemId: string };
    const { status } = request.body as { status: 'Paid' | 'Unpaid' | 'Waived' | 'Pending' };

    if (!['Paid', 'Unpaid', 'Waived', 'Pending'].includes(status)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid status' });
    }

    const paidAt = status === 'Paid' || status === 'Waived' ? new Date() : null;

    const { rows } = await query(
      `UPDATE recurring_cycle_item
       SET status = $1, paid_at = $2
       WHERE id = $3
       RETURNING id, cycle_id, user_id, amount_due AS "amountDue", status, paid_at AS "paidAt"`,
      [status, paidAt, itemId]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Cycle item not found' });
    }

    // Check if the whole cycle is now settled
    const cycleId = rows[0].cycle_id;
    const { rows: pendingItems } = await query(
      `SELECT 1 FROM recurring_cycle_item WHERE cycle_id = $1 AND status NOT IN ('Paid', 'Waived')`,
      [cycleId]
    );

    const cycleStatus = pendingItems.length === 0 ? 'Settled' : 'Open';
    await query('UPDATE recurring_cycle SET status = $1 WHERE id = $2', [cycleStatus, cycleId]);

    return reply.send({ ...rows[0], cycleStatus, message: 'Status updated successfully' });
  });

  /**
   * DELETE /recurring/:id
   * Delete a recurring subscription plan (Admin only)
   */
  fastify.put('/recurring/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role, id: userId } = request.user as { role: string; id: string };
    const { id } = request.params as { id: string };
    const { title, totalAmount, categoryId, billingDay, splitType } = request.body as any;

    const { rows: check } = await query('SELECT creator_id FROM recurring_expense WHERE id = $1', [id]);
    if (check.length === 0) return reply.status(404).send({ error: 'Not Found' });

    if (role !== 'Admin' && check[0].creator_id !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only creators or admins can edit' });
    }

    await query(
      `UPDATE recurring_expense SET title = $1, total_amount = $2, category_id = $3, billing_day = $4, split_type = COALESCE($5, split_type) WHERE id = $6`,
      [title, totalAmount, categoryId, billingDay, splitType, id]
    );

    // If equal split, update participants
    if (!splitType || splitType === 'equal') {
      const { rows: activeRows } = await query('SELECT id FROM recurring_participant WHERE recurring_expense_id = $1 AND is_active = true', [id]);
      if (activeRows.length > 0) {
        const newShare = Number((Number(totalAmount) / activeRows.length).toFixed(2));
        await query('UPDATE recurring_participant SET amount = $1 WHERE recurring_expense_id = $2 AND is_active = true', [newShare, id]);
      }
    }

    // Recalculate Open Cycles
    const { rows: openCycles } = await query(`SELECT period_key FROM recurring_cycle WHERE recurring_expense_id = $1 AND status = 'Open'`, [id]);
    for (const c of openCycles) {
      await ensureCycle(id, c.period_key);
    }

    return reply.send({ message: 'Subscription updated successfully' });
  });

  fastify.delete('/recurring/:id', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user as { role: string; id: string };
    if (role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only administrators can delete subscriptions' });
    }

    const { id } = request.params as { id: string };

    const { rows } = await query(
      'DELETE FROM recurring_expense WHERE id = $1 RETURNING id, title',
      [id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Subscription not found' });
    }

    return reply.send({ message: 'Subscription deleted successfully', id, title: rows[0].title });
  });
}
