class GitLabRunner {
    constructor() {
        this.socket = io();
        this.currentRunId = null;
        this.initializeSocketListeners();
        this.initializeUIListeners();
        this.requestNotificationPermission();
        this.loadRuns();

        // Refresh runs list periodically
        setInterval(() => this.loadRuns(), 10000);
    }

    initializeSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

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

        // Only handle Ctrl/Cmd + N for new run, let browser handle Ctrl/Cmd + R
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.startNewRun();
            }
            // Let the browser handle Ctrl/Cmd + R normally
        });
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            await Notification.requestPermission();
        }
    }

    async startNewRun() {
        try {
            const startButton = document.getElementById('startRun');
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
            const startButton = document.getElementById('startRun');
            startButton.disabled = false;
            startButton.textContent = 'Start New Run';
        }
    }

    async loadRuns() {
        try {
            const response = await fetch('/api/runs');
            const { data: runs } = await response.json();
            this.displayRuns(runs);

            // If we have a current run, update its output
            if (this.currentRunId) {
                const currentRun = runs.find(run => run.id === this.currentRunId);
                if (currentRun && currentRun.status !== 'running') {
                    document.getElementById('output').textContent = currentRun.output || '';
                }
            }
        } catch (error) {
            console.error('Failed to load runs:', error);
            document.getElementById('runsList').innerHTML =
                '<div class="loading">Failed to load runs. Please refresh.</div>';
        }
    }

    displayRuns(runs) {
        const runsList = document.getElementById('runsList');
        if (!runs.length) {
            runsList.innerHTML = '<div class="loading">No runs yet. Start a new run!</div>';
            return;
        }

        runsList.innerHTML = runs.map(run => `
            <div class="run-item ${this.getRunStatus(run)}" 
                 data-run-id="${run.id}"
                 onclick="app.showRun('${run.id}')">
                <div class="run-item-content">
                    <div class="run-item-header">
                        <div class="run-title">Run ${run.id}</div>
                        <div class="status-badge ${this.getRunStatus(run)}">
                            ${this.getRunStatusText(run)}
                        </div>
                    </div>
                    <div class="run-timestamp">
                        ${new Date(run.timestamp).toLocaleString()}
                        ${run.status === 'running' ? '<span class="spinner">⟳</span>' : ''}
                    </div>
                </div>
            </div>
        `).join('');

        if (this.currentRunId) {
            const currentElement = runsList.querySelector(`[data-run-id="${this.currentRunId}"]`);
            if (currentElement) {
                currentElement.classList.add('selected');
            }
        }
    }

    getRunStatus(run) {
        return run.status || (run.success === null ? 'running' : (run.success ? 'success' : 'failure'));
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

            // Update output
            const outputElement = document.getElementById('output');
            outputElement.textContent = run.output || '';
            outputElement.scrollTop = outputElement.scrollHeight;

            // Update UI to show which run is selected
            document.querySelectorAll('.run-item').forEach(item => {
                item.classList.toggle('selected', item.dataset.runId === runId);
            });

            // Update page title
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
            runElement.classList.remove('running', 'success', 'failure');
            runElement.classList.add(success ? 'success' : 'failure');

            const statusBadge = runElement.querySelector('.status-badge');
            if (statusBadge) {
                statusBadge.className = `status-badge ${success ? 'success' : 'failure'}`;
                statusBadge.textContent = success ? 'Success' : 'Failed';
            }

            // Remove spinner if present
            const spinner = runElement.querySelector('.spinner');
            if (spinner) {
                spinner.remove();
            }
        }
    }

    showNotification(runId, success) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const title = `CI Run ${success ? 'Succeeded' : 'Failed'}`;
            const options = {
                body: `Run ${runId} completed at ${new Date().toLocaleString()}`,
                icon: '/favicon.ico', // You can add a favicon for notifications
                tag: `run-${runId}`, // Prevents duplicate notifications
                requireInteraction: false, // Auto-close after a while
                silent: false // Play sound
            };

            const notification = new Notification(title, options);
            notification.onclick = () => {
                // Focus on window and show the run when notification is clicked
                window.focus();
                this.showRun(runId);
            };
        }
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// Initialize the application
const app = new GitLabRunner();
window.app = app;

// Handle service worker if needed
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(error => {
        console.error('ServiceWorker registration failed:', error);
    });
}
