import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/pool.js';

export default async function categoryRoutes(fastify: FastifyInstance) {
  /**
   * GET /categories
   * Authenticated — list all expense categories
   */
  fastify.get('/categories', { preHandler: [fastify.authenticate] }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const { rows } = await query('SELECT id, name, icon, color FROM category ORDER BY name');
    return reply.send(rows);
  });
}