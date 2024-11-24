// src/server/runner.ts
import { spawn, type SpawnOptions, type ChildProcess } from 'child_process';
import path from 'path';
import { Server } from 'socket.io';
import { gitLabService } from './gitlab';
import { db } from './db';
import config from '../config';
import fs from 'fs/promises';

export async function startRunner(io: Server): Promise<string> {
    const runId = Date.now().toString();
    const repoPath = path.join(process.cwd(), 'repos', runId);
    let processInstance: ChildProcess | null = null;

    try {
        // Create run record in database
        await db.createRun(runId);
        console.log('Created run record:', runId);

        // Ensure repos directory exists
        await fs.mkdir(path.join(process.cwd(), 'repos'), { recursive: true });

        // Clone the repository
        const clonedPath = await gitLabService.cloneRepo(
            config.gitlab.repoUrl,
            config.gitlab.username,
            config.gitlab.token,
            repoPath
        );

        // Check if ci.sh exists
        const scriptPath = path.join(clonedPath, 'ci.sh');
        try {
            await fs.access(scriptPath, fs.constants.F_OK | fs.constants.X_OK);
        } catch (error) {
            throw new Error('ci.sh script not found or not executable');
        }

        // Make the script executable
        await fs.chmod(scriptPath, '755');

        return new Promise<string>((resolve, reject) => {
            const spawnOptions: SpawnOptions = {
                cwd: clonedPath,
                stdio: ['ignore', 'pipe', 'pipe']
            };

            let output = '';

            try {
                processInstance = spawn('bash', [scriptPath], spawnOptions);

                if (!processInstance || !processInstance.stdout || !processInstance.stderr) {
                    throw new Error('Failed to start process');
                }

                processInstance.stdout.on('data', async (data: Buffer) => {
                    const chunk = data.toString();
                    output += chunk;
                    await db.appendOutput(runId, chunk);
                    io.emit('output', { runId, chunk });
                });

                processInstance.stderr.on('data', async (data: Buffer) => {
                    const chunk = data.toString();
                    output += chunk;
                    await db.appendOutput(runId, chunk);
                    io.emit('output', { runId, chunk });
                });

                processInstance.on('error', async (error: Error) => {
                    console.error('Process error:', error);
                    const errorMessage = `Process error: ${error.message}\n${output}`;
                    await db.updateRun(runId, {
                        success: false,
                        output: errorMessage
                    });
                    reject(error);
                });

                processInstance.on('close', async (code: number) => {
                    const success = code === 0;
                    try {
                        await db.updateRun(runId, {
                            success,
                            output
                        });
                        io.emit('run-complete', { runId, success });

                        // Clean up: remove the cloned repository
                        try {
                            await fs.rm(clonedPath, { recursive: true, force: true });
                        } catch (error) {
                            console.error('Failed to clean up repository:', error);
                        }

                        resolve(runId);
                    } catch (error) {
                        console.error('Failed to update run status:', error);
                        reject(error);
                    }
                });
            } catch (error) {
                console.error('Failed to spawn process:', error);
                reject(error);
            }
        });
    } catch (error) {
        console.error('Runner error:', error);

        // Update run with failure status
        await db.updateRun(runId, {
            success: false,
            output: `Error: ${(error as Error).message}`
        });

        // Clean up child process if it exists
        // if (processInstance && !processInstance.killed) {
        //     processInstance.kill();
        // }

        throw error;
    }
}
