import express from 'express';

const app = express();

app.use(express.json());

app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

// Unknown /api routes return our standard error shape.
app.use('/api', (req, res) => {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});

export default app;
