class GitLabRunner {
    constructor() {
        this.socket = io();
        this.currentRunId = null;
        this.initializeSocketListeners();
        this.initializeUIListeners();
        this.requestNotificationPermission();
        this.loadRuns();
        setInterval(() => this.loadRuns(), 10000);
    }

    initializeSocketListeners() {
        this.socket.on('commit-detected', ({ runId, commit }) => {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('New Commit Detected', {
                    body: `${commit.author}: ${commit.message}`
                });
            }

            const toast = document.createElement('div');
            toast.className = 'fixed bottom-5 right-5 bg-white rounded-lg shadow-lg max-w-sm overflow-hidden animate-slide-in z-50';
            toast.innerHTML = `
                <div class="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                    <strong>New Commit Detected</strong>
                    <small>${new Date().toLocaleTimeString()}</small>
                </div>
                <div class="p-4">
                    <div class="font-semibold">${commit.author}</div>
                    <div>${commit.message}</div>
                    <div class="mt-2 text-gray-500">
                        <small>Commit ${commit.id}</small>
                    </div>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        });

        this.socket.on('connect', () => console.log('Connected to server'));
        this.socket.on('disconnect', () => console.log('Disconnected from server'));

        this.socket.on('output', ({ runId, chunk }) => {
            if (runId === this.currentRunId) {
                this.appendOutput(chunk);
            }
        });

        this.socket.on('run-complete', ({ runId, success }) => {
            this.updateRunStatus(runId, success);
            this.loadRuns();
            this.showNotification(runId, success);
        });
    }

    initializeUIListeners() {
        document.getElementById('startRun').addEventListener('click', () => this.startNewRun());
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.startNewRun();
            }
        });
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            await Notification.requestPermission();
        }
    }

    async startNewRun() {
        const startButton = document.getElementById('startRun');
        try {
            startButton.disabled = true;
            startButton.textContent = 'Starting...';

            const response = await fetch('/api/runs/start', { method: 'POST' });
            const { data } = await response.json();
            this.currentRunId = data.runId;
            this.clearOutput();
            await this.loadRuns();
            this.showRun(data.runId);
        } catch (error) {
            console.error('Failed to start run:', error);
            alert('Failed to start run. Please try again.');
        } finally {
            startButton.disabled = false;
            startButton.textContent = 'Start New Run';
        }
    }

    async loadRuns() {
        try {
            const response = await fetch('/api/runs');
            const { data: runs } = await response.json();
            this.displayRuns(runs);

            if (this.currentRunId) {
                const currentRun = runs.find(run => run.id === this.currentRunId);
                if (currentRun && currentRun.status !== 'running') {
                    document.getElementById('output').textContent = currentRun.output || '';
                }
            }
        } catch (error) {
            console.error('Failed to load runs:', error);
            document.getElementById('runsList').innerHTML =
                '<div class="p-4 text-gray-500">Failed to load runs. Please refresh.</div>';
        }
    }

    displayRuns(runs) {
        const runsList = document.getElementById('runsList');
        if (!runs.length) {
            runsList.innerHTML = '<div class="p-4 text-gray-500">No runs yet. Start a new run!</div>';
            return;
        }

        runsList.innerHTML = runs.map(run => `
            <div class="run-item p-4 mb-2.5 rounded-lg bg-white cursor-pointer transition-all hover:translate-x-1 hover:shadow-sm border border-gray-200 flex flex-col gap-2 ${this.getRunStatus(run)}"
                 data-run-id="${run.id}"
                 onclick="app.showRun('${run.id}')">
                <div class="flex justify-between items-center">
                    <div class="font-semibold text-gray-800">Run ${run.id}</div>
                    <div class="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${this.getRunStatusClasses(run)}">
                        ${this.getRunStatusText(run)}
                    </div>
                </div>
                <div class="text-sm text-gray-500">
                    ${new Date(run.timestamp).toLocaleString()}
                    ${run.status === 'running' ? '<span class="animate-spin ml-2">⟳</span>' : ''}
                </div>
            </div>
        `).join('');

        if (this.currentRunId) {
            const currentElement = runsList.querySelector(`[data-run-id="${this.currentRunId}"]`);
            if (currentElement) {
                currentElement.classList.add('ring-2', 'ring-blue-500');
            }
        }
    }

    getRunStatus(run) {
        return run.status || (run.success === null ? 'running' : (run.success ? 'success' : 'failure'));
    }

    getRunStatusClasses(run) {
        const status = this.getRunStatus(run);
        const classes = {
            running: 'bg-blue-50 text-blue-700 border border-blue-700 animate-pulse',
            success: 'bg-green-50 text-green-700 border border-green-700',
            failure: 'bg-red-50 text-red-700 border border-red-700'
        };
        return classes[status] || '';
    }

    getRunStatusText(run) {
        if (run.status === 'running') return 'Running';
        return run.success ? 'Success' : 'Failed';
    }

    async showRun(runId) {
        try {
            this.currentRunId = runId;
            const response = await fetch(`/api/runs/${runId}`);
            const { data: run } = await response.json();

            const outputElement = document.getElementById('output');
            outputElement.textContent = run.output || '';
            outputElement.scrollTop = outputElement.scrollHeight;

            document.querySelectorAll('.run-item').forEach(item => {
                item.classList.toggle('ring-2', item.dataset.runId === runId);
                item.classList.toggle('ring-blue-500', item.dataset.runId === runId);
            });

            document.title = `Run ${runId} (${this.getRunStatusText(run)}) - GitLab CI Runner`;
        } catch (error) {
            console.error('Failed to load run:', error);
            document.getElementById('output').textContent = 'Failed to load run output.';
        }
    }

    appendOutput(chunk) {
        const output = document.getElementById('output');
        output.textContent += chunk;
        output.scrollTop = output.scrollHeight;
    }

    clearOutput() {
        document.getElementById('output').textContent = '';
    }

    updateRunStatus(runId, success) {
        const runElement = document.querySelector(`[data-run-id="${runId}"]`);
        if (runElement) {
            runElement.className = `run-item p-4 mb-2.5 rounded-lg bg-white cursor-pointer transition-all hover:translate-x-1 hover:shadow-sm border border-gray-200 flex flex-col gap-2 ${success ? 'success' : 'failure'}`;

            const statusBadge = runElement.querySelector('div:first-child > div:last-child');
            if (statusBadge) {
                statusBadge.className = `px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${success ? 'bg-green-50 text-green-700 border border-green-700' : 'bg-red-50 text-red-700 border border-red-700'}`;
                statusBadge.textContent = success ? 'Success' : 'Failed';
            }

            const spinner = runElement.querySelector('.animate-spin');
            if (spinner) {
                spinner.remove();
            }
        }
    }

    showNotification(runId, success) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(
                `CI Run ${success ? 'Succeeded' : 'Failed'}`,
                {
                    body: `Run ${runId} completed at ${new Date().toLocaleString()}`,
                    icon: '/favicon.ico',
                    tag: `run-${runId}`,
                    requireInteraction: false,
                    silent: false
                }
            );
            notification.onclick = () => {
                window.focus();
                this.showRun(runId);
            };
        }
    }
}

const app = new GitLabRunner();
window.app = app;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(error => {
        console.error('ServiceWorker registration failed:', error);
    });
}
