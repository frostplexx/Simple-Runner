import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import { initializeDb } from './db';
import { setupGitLabHooks } from './gitlab';
import { startRunner } from './runner';
import config from '../config';
import { Run } from '../types';

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../client')));

// Initialize database
initializeDb();

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('disconnect', () => console.log('Client disconnected'));
});

// API Routes
app.get('/api/runs', async (_req, res) => {
    try {
        const runs = await db.getAllRuns();
        res.json(runs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch runs' });
    }
});

app.post('/api/runs/start', async (_req, res) => {
    try {
        const runId = await startRunner(io);
        res.json({ runId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to start run' });
    }
});

app.get('/api/runs/:id', async (req, res) => {
    try {
        const run = await db.getRun(req.params.id);
        if (!run) {
            res.status(404).json({ error: 'Run not found' });
            return;
        }
        res.json(run);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch run' });
    }
});

server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
