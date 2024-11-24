import { spawn } from 'child_process';
import path from 'path';
import { Server } from 'socket.io';
import { cloneRepo } from './gitlab';
import { db } from './db';
import config from '../config';
import { WebhookPayload } from '../types';

export async function startRunner(io: Server): Promise<string> {
    const runId = Date.now().toString();
    const repoPath = await cloneRepo();

    await db.createRun(runId);

    const scriptPath = path.join(repoPath, 'ci.sh');
    const process = spawn('bash', [scriptPath], {
        cwd: repoPath
    });

    let output = '';

    process.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        io.emit('output', { runId, chunk });
    });

    process.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        io.emit('output', { runId, chunk });
    });

    process.on('close', async (code: number) => {
        const success = code === 0;
        await db.updateRun(runId, { success, output });
        io.emit('run-complete', { runId, success });

        await sendNotification(runId, success);
    });

    return runId;
}

async function sendNotification(runId: string, success: boolean): Promise<void> {
    if (config.webhook.url) {
        const payload: WebhookPayload = {
            runId,
            success,
            timestamp: new Date().toISOString()
        };

        try {
            await fetch(config.webhook.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Webhook notification failed:', error);
        }
    }
}
