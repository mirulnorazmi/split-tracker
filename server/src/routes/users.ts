import crypto from "crypto";

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, getClient } from '../db/pool.js';

interface UpdateRoleBody {
  role: 'Admin' | 'Standard User';
}

export default async function userRoutes(fastify: FastifyInstance) {
  /**
   * GET /users
   * Authenticated — list users. Admins can see all/filter; standard users only see active users.
   */
  fastify.get('/users', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role: userRole } = request.user as { role: string };
    const { status, role } = request.query as { status?: string; role?: string };

    let sql = 'SELECT id, name, email, status, role, initials, avatar, is_placeholder AS "isPlaceholder", created_by AS "createdBy", created_at FROM "user"';
    const params: any[] = [];
    const conditions: string[] = [];

    if (userRole !== 'Admin') {
      // Standard users only see Active users
      conditions.push(`status = 'Active'`);
    } else {
      if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
      }
      if (role) {
        params.push(role);
        conditions.push(`role = $${params.length}`);
      }
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const { rows } = await query(sql, params);
    return reply.send(rows);
  });

  /**
   * POST /users/placeholder
   * Authenticated — create a placeholder (unregistered) user participant
   */
  fastify.post('/users/placeholder', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: creatorId } = request.user as { id: string };
    const { name } = (request.body as { name?: string }) || {};

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Name is required for placeholder participant' });
    }

    const trimmedName = name.trim();
    const initials = trimmedName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || trimmedName.slice(0, 2).toUpperCase();

    const { rows } = await query(
      `INSERT INTO "user" (name, initials, status, role, is_placeholder, created_by)
       VALUES ($1, $2, 'Active', 'Standard User', true, $3)
       RETURNING id, name, initials, status, role, is_placeholder AS "isPlaceholder", created_by AS "createdBy", created_at AS "createdAt"`,
      [trimmedName, initials, creatorId]
    );

    return reply.status(201).send(rows[0]);
  });

  /**
   * GET /users/placeholders
   * Authenticated — list all active placeholder participants and their current subscriptions
   */
  fastify.get('/users/placeholders', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { rows } = await query(
      `SELECT u.id, u.name, u.initials, u.created_by AS "createdBy", u.created_at AS "createdAt",
              COALESCE(
                (SELECT json_agg(json_build_object('id', re.id, 'title', re.title))
                 FROM recurring_participant rp
                 JOIN recurring_expense re ON re.id = rp.recurring_expense_id
                 WHERE rp.user_id = u.id),
                '[]'
              ) AS "subscriptions"
       FROM "user" u
       WHERE u.is_placeholder = true
       ORDER BY u.created_at DESC`
    );
    return reply.send(rows);
  });

  /**
   * PATCH /users/:id/approve
   * Admin only — approve a pending user registration and optionally assign/link to a placeholder participant
   */
  fastify.patch('/users/:id/approve', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user as { role: string };
    if (role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { linkPlaceholderId } = (request.body as { linkPlaceholderId?: string }) || {};

    if (linkPlaceholderId) {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // 1. Verify pending user exists
        const userRes = await client.query('SELECT id, name, email FROM "user" WHERE id = $1 AND status = \'Pending\'', [id]);
        if (userRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: 'Not Found', message: 'Pending user not found' });
        }

        // 2. Verify placeholder exists
        const phRes = await client.query('SELECT id, name FROM "user" WHERE id = $1 AND is_placeholder = true', [linkPlaceholderId]);
        if (phRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: 'Not Found', message: 'Placeholder user not found' });
        }
        const placeholderName = phRes.rows[0].name;

        // 3. Reassign recurring_participant:
        await client.query(`
          DELETE FROM recurring_participant
          WHERE user_id = $1
            AND recurring_expense_id IN (SELECT recurring_expense_id FROM recurring_participant WHERE user_id = $2)
        `, [linkPlaceholderId, id]);

        await client.query(
          'UPDATE recurring_participant SET user_id = $1 WHERE user_id = $2',
          [id, linkPlaceholderId]
        );

        // 4. Reassign recurring_cycle_item
        await client.query(`
          DELETE FROM recurring_cycle_item
          WHERE user_id = $1
            AND cycle_id IN (SELECT cycle_id FROM recurring_cycle_item WHERE user_id = $2)
        `, [linkPlaceholderId, id]);

        await client.query(
          'UPDATE recurring_cycle_item SET user_id = $1 WHERE user_id = $2',
          [id, linkPlaceholderId]
        );

        // 5. Reassign expense_participant
        await client.query(`
          DELETE FROM expense_participant
          WHERE user_id = $1
            AND expense_id IN (SELECT expense_id FROM expense_participant WHERE user_id = $2)
        `, [linkPlaceholderId, id]);

        await client.query(
          'UPDATE expense_participant SET user_id = $1 WHERE user_id = $2',
          [id, linkPlaceholderId]
        );

        // 6. Reassign payment payer_id
        await client.query(
          'UPDATE payment SET payer_id = $1 WHERE payer_id = $2',
          [id, linkPlaceholderId]
        );

        // 7. Reassign folder created_by if any
        await client.query(
          'UPDATE folder SET created_by = $1 WHERE created_by = $2',
          [id, linkPlaceholderId]
        );

        // 8. Delete the placeholder user
        await client.query('DELETE FROM "user" WHERE id = $1', [linkPlaceholderId]);

        // 9. Activate pending user
        const updatedRes = await client.query(
          `UPDATE "user" SET status = 'Active', updated_at = NOW() WHERE id = $1 RETURNING id, name, email, status`,
          [id]
        );

        await client.query('COMMIT');
        return reply.send({
          ...updatedRes.rows[0],
          message: `User registration approved and successfully linked to placeholder "${placeholderName}".`,
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const { rows } = await query(
      `UPDATE "user" SET status = 'Active', updated_at = NOW() WHERE id = $1 AND status = 'Pending'
       RETURNING id, status`,
      [id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found or already active' });
    }

    return reply.send({ ...rows[0], message: 'User registration approved.' });
  });

  /**
   * PATCH /users/:id/role
   * Admin only — change a user's role
   */
  fastify.patch('/users/:id/role', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role: adminRole } = request.user as { role: string };
    if (adminRole !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { role } = request.body as UpdateRoleBody;

    if (!role || !['Admin', 'Standard User'].includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'role must be "Admin" or "Standard User"' });
    }

    const { rows } = await query(
      `UPDATE "user" SET role = $1, updated_at = NOW() WHERE id = $2
       RETURNING id, role`,
      [role, id]
    );

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    return reply.send({ ...rows[0], message: 'User role updated successfully.' });
  });

  /**
   * POST /users/:id/password-reset
   * Admin only — trigger password reset for a user.
   * Generates a secure token, stores it in DB with 1-hour expiry, and sends a reset email.
   */
  fastify.post('/users/:id/password-reset', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user as { role: string };
    if (role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { rows } = await query('SELECT id, name, email FROM "user" WHERE id = $1', [id]);

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    const user = rows[0];
    const resetToken = crypto.randomUUID();

    // Store token with 1-hour expiry
    await query(
      `UPDATE "user" SET password_reset_token = $1, password_reset_expires = NOW() + INTERVAL '1 hour', updated_at = NOW() WHERE id = $2`,
      [resetToken, id]
    );

    // Send reset email
    try {
      const { sendPasswordResetEmail } = await import('../utils/mailer.js');
      const baseUrl = request.headers.origin || 'http://localhost:5173';
      await sendPasswordResetEmail(user.email, resetToken, baseUrl, user.name);
    } catch (err) {
      console.error('Failed to send password reset email:', err);
      return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to send password reset email. Please try again.' });
    }

    return reply.send({ message: `Password reset email sent to ${user.email}.` });
  });

  /**
   * PUT /users/profile
   * Authenticated — Update own profile (name, email)
   */
  fastify.put('/users/profile', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.user as { id: string };
    const { name, email } = request.body as { name?: string; email?: string };

    if (!name && !email) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Nothing to update' });
    }

    const { rows: userRows } = await query('SELECT email FROM "user" WHERE id = $1', [id]);
    if (userRows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    const currentEmail = userRows[0].email;
    let newName = name;
    let pendingEmail = null;
    let token = null;

    if (email && email.toLowerCase().trim() !== currentEmail) {
      // Check if email already exists
      const { rows: emailCheck } = await query('SELECT id FROM "user" WHERE email = $1 AND id != $2', [email.toLowerCase().trim(), id]);
      if (emailCheck.length > 0) {
        return reply.status(409).send({ error: 'Conflict', message: 'Email is already in use by another account' });
      }

      pendingEmail = email.toLowerCase().trim();
      token = crypto.randomUUID();
    }

    if (pendingEmail && token) {
      await query(
        `UPDATE "user" SET name = COALESCE($1, name), pending_email = $2, verification_token = $3, verification_expires = NOW() + INTERVAL '24 hours', updated_at = NOW() WHERE id = $4`,
        [newName, pendingEmail, token, id]
      );
      
      // Dynamic import to avoid breaking if mailer fails at top level
      try {
        const { sendVerificationEmail } = await import('../utils/mailer.js');
        // Base URL from origin or referer, fallback to localhost:3000
        const baseUrl = request.headers.origin || 'http://localhost:3000';
        await sendVerificationEmail(pendingEmail, token, baseUrl);
      } catch (err) {
        console.error('Failed to send email:', err);
      }

      return reply.send({ message: 'Profile updated. Please check your new email to verify the change.', pendingVerification: true });
    } else {
      await query(
        `UPDATE "user" SET name = COALESCE($1, name), updated_at = NOW() WHERE id = $2`,
        [newName, id]
      );
      return reply.send({ message: 'Profile updated successfully.', pendingVerification: false });
    }
  });

  /**
   * POST /users/verify-email
   * Verify an email change using the token
   */
  fastify.post('/users/verify-email', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.body as { token: string };

    if (!token) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Token is required' });
    }

    const { rows } = await query(
      `SELECT id, pending_email FROM "user" WHERE verification_token = $1 AND verification_expires > NOW()`,
      [token]
    );

    if (rows.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid or expired verification token' });
    }

    const user = rows[0];

    // Update email and clear pending
    await query(
      `UPDATE "user" SET email = $1, pending_email = NULL, verification_token = NULL, verification_expires = NULL, updated_at = NOW() WHERE id = $2`,
      [user.pending_email, user.id]
    );

    return reply.send({ message: 'Email verified successfully.' });
  });
}
