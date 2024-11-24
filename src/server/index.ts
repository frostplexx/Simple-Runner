import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import cors from 'cors';
import { initializeDb } from './db';
import { startRunner } from './runner';
import config from '../config';
import { db } from './db';
import { RepositoryPoller } from './poller';

// Custom error class for API errors
class APIError extends Error {
    constructor(
        public statusCode: number,
        message: string
    ) {
        super(message);
        this.name = 'APIError';
    }
}

// Types for request parameters
interface RunParams {
    id: string;
}


const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: config.corsOrigins || '*',
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    connectTimeout: 60000
});


// Initialize poller
const poller = new RepositoryPoller(io);

// Middleware setup
app.use(cors({
    origin: config.corsOrigins || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Error handling middleware
const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err);

    if (err instanceof APIError) {
        res.status(err.statusCode).json({
            error: err.message,
            status: 'error'
        });
    } else {
        res.status(500).json({
            error: 'Internal server error',
            status: 'error'
        });
    }
};

// Initialize database
try {
    initializeDb();
    console.log('Database initialized successfully');
} catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
}

// WebSocket connection handling
io.on('connection', (socket: Socket) => {
    const clientId = socket.id;
    console.log(`Client connected: ${clientId}`);

    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${clientId}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
        console.error(`Socket error for client ${clientId}:`, error);
    });
});

// API Routes
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

app.get('/api/runs', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const runs = await db.getAllRuns();
        res.json({
            status: 'success',
            data: runs,
            count: runs.length
        });
    } catch (error) {
        next(new APIError(500, 'Failed to fetch runs'));
    }
});

app.post('/api/runs/start', async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Validate request body if needed
        const runId = await startRunner(io);
        res.json({
            status: 'success',
            data: { runId }
        });
    } catch (error) {
        next(new APIError(500, 'Failed to start run'));
    }
});

app.get('/api/runs/:id', async (req: Request<RunParams>, res: Response, next: NextFunction) => {
    try {
        const run = await db.getRun(req.params.id);
        if (!run) {
            throw new APIError(404, 'Run not found');
        }
        res.json({
            status: 'success',
            data: run
        });
    } catch (error) {
        if (error instanceof APIError) {
            next(error);
        } else {
            next(new APIError(500, 'Failed to fetch run'));
        }
    }
});


app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '../../public/index.html'));
    } else {
        next();
    }
});


// Catch 404 errors
app.use('/api/*', (_req: Request, _res: Response, next: NextFunction) => {
    next(new APIError(404, 'API endpoint not found'));
});

app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new APIError(404, 'Resource not found'));
});

// Apply error handling middleware
app.use(errorHandler);

// Graceful shutdown handling
const shutdownGracefully = async () => {
    console.log('Shutting down gracefully...');

    // Close all Socket.IO connections
    io.close(() => {
        console.log('All WebSocket connections closed');
    });

    // Close HTTP server with a timeout
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdownGracefully);
process.on('SIGINT', shutdownGracefully);

// Start the poller when the server starts
let pollIntervalSeconds = 30; // Poll every 30 seconds by default
if (process.env.POLL_INTERVAL) {
    pollIntervalSeconds = parseInt(process.env.POLL_INTERVAL, 10);
}

// Start server
server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    poller.start(pollIntervalSeconds);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdownGracefully();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    shutdownGracefully();
});

export default server;
