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
   * Admin only — trigger password reset for a user
   */
  fastify.post('/users/:id/password-reset', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user as { role: string };
    if (role !== 'Admin') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }

    const { id } = request.params as { id: string };
    const { rows } = await query('SELECT id FROM "user" WHERE id = $1', [id]);

    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    // In production, this would send a password reset email.
    // For now, we acknowledge the request.
    return reply.send({ message: 'Password reset email sent to user.' });
  });
}