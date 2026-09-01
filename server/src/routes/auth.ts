import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { config } from '../config.js';

interface RegisterBody {
  name: string;
  email: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ChangePasswordBody {
  oldPassword: string;
  newPassword: string;
}

export default async function authRoutes(fastify: FastifyInstance) {
  // Handler for user registration
  const handleRegister = async (request: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password } = request.body as RegisterBody;

    if (!name || !email || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Name, email, and password are required' });
    }

    const trimmedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Please enter a valid email address' });
    }

    if (password.length < 8) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Password must be at least 8 characters long' });
    }

    // Check for existing email
    const existing = await query('SELECT id FROM "user" WHERE email = $1', [trimmedEmail]);
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Conflict', message: 'An account with this email already exists' });
    }

    // Check if this is the first user in the system (bootstrap admin)
    const userCountResult = await query('SELECT COUNT(*)::int as count FROM "user"');
    const isFirstUser = (userCountResult.rows[0]?.count || 0) === 0;

    const initialStatus = isFirstUser ? 'Active' : 'Pending';
    const initialRole = isFirstUser ? 'Admin' : 'Standard User';

    const hashedPassword = await bcrypt.hash(password, 12);
    const initials = trimmedName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || trimmedName.slice(0, 2).toUpperCase();

    const { rows } = await query(
      `INSERT INTO "user" (name, email, password, initials, status, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, status, role, initials, avatar, created_at`,
      [trimmedName, trimmedEmail, hashedPassword, initials, initialStatus, initialRole]
    );

    const newUser = rows[0];

    // If active (first user), generate token immediately
    if (initialStatus === 'Active') {
      const token = fastify.jwt.sign(
        { id: newUser.id, role: newUser.role },
        { expiresIn: config.jwt.expiresIn }
      );
      return reply.status(201).send({
        token,
        user: newUser,
        message: 'Welcome! You have been registered and activated as the system Administrator.',
      });
    }

    return reply.status(201).send({
      user: newUser,
      message: 'Registration successful. Your account is pending administrator approval before you can sign in.',
    });
  };

  // Handler for user login
  const handleLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as LoginBody;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Email and password are required' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    const { rows } = await query(
      'SELECT id, name, email, password, status, role, initials, avatar, created_at FROM "user" WHERE email = $1',
      [trimmedEmail]
    );

    if (rows.length === 0) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    const user = rows[0];

    if (user.status !== 'Active') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Your account is pending administrator approval. Please contact an admin to activate your access.',
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign(
      { id: user.id, role: user.role },
      { expiresIn: config.jwt.expiresIn }
    );

    const { password: _, ...safeUser } = user;
    return reply.send({ token, user: safeUser, message: 'Login successful' });
  };

  /**
   * POST /users/register & /auth/register
   * Public — register a new user
   */
  fastify.post('/users/register', handleRegister);
  fastify.post('/auth/register', handleRegister);

  /**
   * POST /users/login & /auth/login
   * Public — authenticate a user and return JWT
   */
  fastify.post('/users/login', handleLogin);
  fastify.post('/auth/login', handleLogin);

  /**
   * POST /auth/logout
   * Public/Authenticated — clear session acknowledge
   */
  fastify.post('/auth/logout', async () => ({ message: 'Logged out successfully' }));

  /**
   * GET /me
   * Authenticated — returns current user profile
   */
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.user as { id: string };
    const { rows } = await query(
      'SELECT id, name, email, status, role, initials, avatar, created_at FROM "user" WHERE id = $1',
      [id]
    );
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }
    return reply.send(rows[0]);
  });

  /**
   * POST /auth/change-password & POST /users/change-password
   * Authenticated — change password for current user
   */
  const handleChangePassword = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.user as { id: string };
    const { oldPassword, newPassword } = request.body as ChangePasswordBody;

    if (!oldPassword || !newPassword) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Both current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return reply.status(400).send({ error: 'Bad Request', message: 'New password must be at least 8 characters' });
    }

    const { rows } = await query('SELECT password FROM "user" WHERE id = $1', [id]);
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
    if (!isMatch) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Incorrect current password' });
    }

    const newHashed = await bcrypt.hash(newPassword, 12);
    await query('UPDATE "user" SET password = $1, updated_at = NOW() WHERE id = $2', [newHashed, id]);

    return reply.send({ message: 'Password updated successfully' });
  };

  fastify.post('/auth/change-password', { preHandler: [fastify.authenticate] }, handleChangePassword);
  fastify.post('/users/change-password', { preHandler: [fastify.authenticate] }, handleChangePassword);
}