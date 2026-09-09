import crypto from "crypto";

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool.js';

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

    let sql = 'SELECT id, name, email, status, role, initials, avatar, created_at FROM "user"';
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
   * PATCH /users/:id/approve
   * Admin only — approve a pending user registration
   */
  fastify.patch('/users/:id/approve', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user as { role: string };
    if (role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
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
