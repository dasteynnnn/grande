import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';
import { authenticateToken } from '../../../middleware/auth.js';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const USERS_KEY = 'grande-users';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Redis helpers
async function getAllUsers() {
  return (await redis.get(USERS_KEY)) || [];
}

async function saveAllUsers(users) {
  await redis.set(USERS_KEY, users);
}

// GET /api/v1/user/
router.get('/', async (req, res) => {
  const users = await getAllUsers();
  const safeUsers = users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// POST /api/v1/user/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  const users = await getAllUsers();
  const exists = users.find(u => u.email === email);
  if (exists) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    name,
    email,
    password: hashedPassword
  };

  users.push(newUser);
  await saveAllUsers(users);

  res.status(201).json({ message: 'User registered successfully' });
});

// POST /api/v1/user/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const users = await getAllUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ message: 'Invalid email or password' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ message: 'Login successful', token });
});

// GET /api/v1/user/me (protected)
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/v1/user/:id (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, email, password } = req.body;

  if (parseInt(id) !== req.user.id) {
    return res.status(403).json({ message: 'Unauthorized: You can only update your own account' });
  }

  let users = await getAllUsers();
  const index = users.findIndex(u => u.id === parseInt(id));
  if (index === -1) return res.status(404).json({ message: 'User not found' });

  if (email && email !== users[index].email) {
    const exists = users.find(u => u.email === email);
    if (exists) return res.status(400).json({ message: 'Email already in use' });
  }

  if (name) users[index].name = name;
  if (email) users[index].email = email;
  if (password) users[index].password = await bcrypt.hash(password, 10);

  await saveAllUsers(users);
  const { password: _, ...safeUser } = users[index];
  res.json({ message: 'User updated successfully', user: safeUser });
});

// DELETE /api/v1/user/:id (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) !== req.user.id) {
    return res.status(403).json({ message: 'Unauthorized: You can only delete your own account' });
  }

  let users = await getAllUsers();
  const index = users.findIndex(u => u.id === parseInt(id));
  if (index === -1) return res.status(404).json({ message: 'User not found' });

  const deletedUser = users.splice(index, 1)[0];
  await saveAllUsers(users);

  res.json({
    message: 'User deleted successfully',
    deletedUser: {
      id: deletedUser.id,
      name: deletedUser.name,
      email: deletedUser.email
    }
  });
});

export default router;
