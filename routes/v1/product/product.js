import express from 'express';
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';
import { authenticateToken } from '../../../middleware/auth.js';

dotenv.config();

const router = express.Router();
const PRODUCTS_KEY = 'products';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function getAllProducts() {
  return (await redis.get(PRODUCTS_KEY)) || [];
}

async function saveAllProducts(products) {
  await redis.set(PRODUCTS_KEY, products);
}

// GET /api/v1/product/
router.get('/', async (req, res) => {
  const products = await getAllProducts();
  res.json(products);
});

// GET /secure - Get all products (auth required)
router.get('/secure', authenticateToken, async (req, res) => {
  const products = await getAllProducts();
  res.json(products);
});

// GET /api/v1/product/:id
router.get('/:id', async (req, res) => {
  const products = await getAllProducts();
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

// GET /secure/:id - Get product by ID (auth required)
router.get('/secure/:id', authenticateToken, async (req, res) => {
  const products = await getAllProducts();
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

// POST /api/v1/product/ (protected)
router.post('/', authenticateToken, async (req, res) => {
  const { name, price, description } = req.body;
  if (!name || !price) return res.status(400).json({ message: 'Name and price are required' });

  const products = await getAllProducts();
  const newProduct = {
  id: products.length + 1,
  name,
  price,
  description: description || '',
  createdBy: req.user.email,
  };

  products.push(newProduct);
  await saveAllProducts(products);

  res.status(201).json({ message: 'Product created', product: newProduct });
});

// PUT /api/v1/product/:id (protected)
router.put('/:id', authenticateToken, async (req, res) => {
  const { name, price, description } = req.body;
  const products = await getAllProducts();
  const index = products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Product not found' });

  if (name) products[index].name = name;
  if (price) products[index].price = price;
  if (description !== undefined) products[index].description = description;

  await saveAllProducts(products);
  res.json({ message: 'Product updated', product: products[index] });
});

// DELETE /api/v1/product/:id (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
  let products = await getAllProducts();
  const index = products.findIndex(p => p.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ message: 'Product not found' });

  const deletedProduct = products.splice(index, 1)[0];
  await saveAllProducts(products);

  res.json({ message: 'Product deleted', product: deletedProduct });
});

export default router;