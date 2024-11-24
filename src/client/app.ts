interface RunDisplayData {
    id: string;
    timestamp: string;
    success: boolean | null;
}

class GitLabRunner {
    private socket: SocketIOClient.Socket;
    private currentRunId: string | null = null;

    constructor() {
        this.socket = io();
        this.initializeSocketListeners();
        this.initializeUIListeners();
        this.requestNotificationPermission();
        this.loadRuns();
    }

    private initializeSocketListeners(): void {
        this.socket.on('output', ({ runId, chunk }: { runId: string; chunk: string }) => {
            if (runId === this.currentRunId) {
                this.appendOutput(chunk);
            }
        });

        this.socket.on('run-complete', ({ runId, success }: { runId: string; success: boolean }) => {
            this.updateRunStatus(runId, success);
            this.loadRuns();
            this.showNotification(runId, success);
        });
    }

    private initializeUIListeners(): void {
        const startButton = document.getElementById('startRun');
        if (startButton) {
            startButton.addEventListener('click', () => this.startNewRun());
        }
    }

    private async requestNotificationPermission(): Promise<void> {
        if ('Notification' in window) {
            await Notification.requestPermission();
        }
    }

    private async startNewRun(): Promise<void> {
        const response = await fetch('/api/runs/start', { method: 'POST' });
        const { runId } = await response.json();
        this.currentRunId = runId;
        this.clearOutput();
        await this.loadRuns();
    }

    private async loadRuns(): Promise<void> {
        const response = await fetch('/api/runs');
        const runs: RunDisplayData[] = await response.json();
        this.displayRuns(runs);
    }

    private displayRuns(runs: RunDisplayData[]): void {
        const runsList = document.getElementById('runsList');
        if (!runsList) return;

        runsList.innerHTML = runs.map(run => `
      <div class="run-item ${run.success ? 'success' : 'failure'}" 
           onclick="app.showRun('${run.id}')">
        <div>Run ${run.id}</div>
        <div>${new Date(run.timestamp).toLocaleString()}</div>
      </div>
    `).join('');
    }

    public async showRun(runId: string): Promise<void> {
        this.currentRunId = runId;
        const response = await fetch(`/api/runs/${runId}`);
        const run = await response.json();
        const outputElement = document.getElementById('output');
        if (outputElement) {
            outputElement.textContent = run.output || '';
        }
    }

    private appendOutput(chunk: string): void {
        const output = document.getElementById('output');
        if (output) {
            output.textContent += chunk;
            output.scrollTop = output.scrollHeight;
        }
    }

    private clearOutput(): void {
        const output = document.getElementById('output');
        if (output) {
            output.textContent = '';
        }
    }

    private updateRunStatus(runId: string, success: boolean): void {
        const runElement = document.querySelector(`[data-run-id="${runId}"]`);
        if (runElement) {
            runElement.classList.remove('success', 'failure');
            runElement.classList.add(success ? 'success' : 'failure');
        }
    }

    private showNotification(runId: string, success: boolean): void {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`CI Run ${success ? 'Succeeded' : 'Failed'}`, {
                body: `Run ${runId} completed at ${new Date().toLocaleString()}`
            });
        }
    }
}

// Initialize the application
const app = new GitLabRunner();
(window as any).app = app; // Make it available globally for onclick handlers
