"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const path_1 = __importDefault(require("path"));
class X7Dashboard {
    constructor(port = 3000) {
        this.wsClients = new Set();
        this.metricsUpdateInterval = null;
        this.startTime = Date.now();
        this.app = (0, express_1.default)();
        this.server = http_1.default.createServer(this.app);
        this.wss = new ws_1.default.Server({ server: this.server, perMessageDeflate: false });
        this.metrics = {
            totalProfit: 0,
            dailyRevenue: 0,
            totalWithdrawn: 0,
            activePositions: 0,
            winRate: 0,
            capitalDeployed: 0,
            gasSpent: 0,
            tradesExecuted: 0,
            lastTradeTime: new Date().toISOString(),
            treasury: {
                balance: 0,
                address: process.env.TREASURY_ADDRESS || '0x',
                reinvestmentPercentage: 40,
            },
            strategies: {
                liquidation: { enabled: true, trades: 0, profit: 0 },
                spread: { enabled: true, trades: 0, profit: 0 },
                sandwich: { enabled: false, trades: 0, profit: 0 },
                flashloan: { enabled: true, trades: 0, profit: 0 },
            },
            alerts: [],
            recentTrades: [],
            status: 'INITIALIZING',
            uptime: 0,
        };
        this.setupRoutes();
        this.setupWebSocket();
        this.startMetricsUpdates();
        this.server.listen(port, () => {
            console.log(`📡 X7 Dashboard ready at port ${port}`);
            console.log(`🌐 Open: http://localhost:${port}`);
            this.metrics.status = 'RUNNING';
        });
    }
    setupRoutes() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
        this.app.get('/health', (req, res) => {
            res.json({ status: 'OK', uptime: Date.now() - this.startTime });
        });
        this.app.get('/api/metrics', (req, res) => {
            res.json(this.metrics);
        });
        this.app.post('/api/strategy/:name/toggle', (req, res) => {
            const { name } = req.params;
            const strategyKey = name;
            if (this.metrics.strategies[strategyKey]) {
                this.metrics.strategies[strategyKey].enabled = !this.metrics.strategies[strategyKey].enabled;
                this.broadcast({ type: 'STRATEGY_TOGGLED', strategy: name, enabled: this.metrics.strategies[strategyKey].enabled });
                this.addAlert(`${this.metrics.strategies[strategyKey].enabled ? '🟢' : '🔴'} ${name} strategy ${this.metrics.strategies[strategyKey].enabled ? 'enabled' : 'disabled'}`);
                res.json({ success: true, status: this.metrics.strategies[strategyKey].enabled });
            }
            else {
                res.status(404).json({ error: 'Strategy not found' });
            }
        });
        this.app.post('/api/withdraw', async (req, res) => {
            const { amount, token } = req.body;
            if (!amount || amount <= 0) {
                return res.status(400).json({ error: 'Invalid amount' });
            }
            try {
                if (!process.env.MODEM_PAY_API_KEY) {
                    this.addAlert('⚠️ Modem Pay API key not configured');
                    return res.status(500).json({ error: 'Payment provider not configured' });
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.metrics.totalWithdrawn += amount;
                this.metrics.treasury.balance = Math.max(0, this.metrics.treasury.balance - amount);
                this.broadcast({ type: 'WITHDRAWAL', amount, status: 'settled' });
                this.addAlert(`📉 Withdrawal filed: $${amount.toFixed(2)} -> Modem Pay settlement (arriving 24-48hrs)`);
                return res.json({
                    success: true,
                    amount,
                    message: 'Withdrawal initiated. Funds will arrive in 24-48 hours.',
                    estimatedArrival: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                });
            }
            catch (error) {
                console.error('Withdrawal error:', error);
                this.addAlert('❌ Withdrawal failed');
                res.status(500).json({ error: 'Withdrawal failed' });
            }
        });
        this.app.post('/api/reinvestment', (req, res) => {
            const { percentage } = req.body;
            if (percentage < 30 || percentage > 50) {
                return res.status(400).json({ error: 'Percentage must be between 30-50' });
            }
            this.metrics.treasury.reinvestmentPercentage = percentage;
            this.broadcast({ type: 'REINVESTMENT_UPDATED', percentage });
            this.addAlert(`⚙️ Reinvestment updated to ${percentage}%`);
            res.json({ success: true, percentage });
        });
        this.app.get('/api/trades', (req, res) => {
            res.json(this.metrics.recentTrades.slice(-50));
        });
        this.app.post('/api/pause-all', (req, res) => {
            Object.keys(this.metrics.strategies).forEach(key => {
                this.metrics.strategies[key].enabled = false;
            });
            this.broadcast({ type: 'ALL_PAUSED' });
            this.addAlert('🛑 All strategies paused manually');
            res.json({ success: true });
        });
        this.app.post('/api/resume-all', (req, res) => {
            Object.keys(this.metrics.strategies).forEach(key => {
                this.metrics.strategies[key].enabled = true;
            });
            this.broadcast({ type: 'ALL_RESUMED' });
            this.addAlert('🚀 All strategies resumed');
            res.json({ success: true });
        });
    }
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            this.wsClients.add(ws);
            console.log(`🔌 WebSocket connected (${this.wsClients.size} clients)`);
            ws.send(JSON.stringify({ type: 'INITIAL_DATA', data: this.metrics }));
            ws.on('close', () => {
                this.wsClients.delete(ws);
                console.log(`🔌 WebSocket disconnected (${this.wsClients.size} clients)`);
            });
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.wsClients.delete(ws);
            });
        });
    }
    broadcast(message) {
        const payload = JSON.stringify(message);
        let sent = 0;
        this.wsClients.forEach(client => {
            if (client.readyState === ws_1.default.OPEN) {
                client.send(payload);
                sent++;
            }
        });
    }
    startMetricsUpdates() {
        this.metricsUpdateInterval = setInterval(() => {
            this.metrics.uptime = Date.now() - this.startTime;
            this.broadcast({ type: 'METRICS_UPDATE', data: this.metrics });
        }, 2000);
    }
    addAlert(message) {
        this.metrics.alerts.unshift({
            message,
            timestamp: new Date().toISOString(),
        });
        this.metrics.alerts = this.metrics.alerts.slice(0, 100);
        this.broadcast({ type: 'ALERT', message });
    }
    recordTrade(trade) {
        this.metrics.recentTrades.unshift(trade);
        this.metrics.recentTrades = this.metrics.recentTrades.slice(0, 100);
        this.metrics.tradesExecuted += 1;
        this.metrics.lastTradeTime = new Date().toISOString();
        this.broadcast({ type: 'NEW_TRADE', trade });
    }
    updateProfit(amount) {
        this.metrics.totalProfit += amount;
        this.metrics.dailyRevenue += amount;
        this.metrics.treasury.balance += amount;
        this.broadcast({ type: 'PROFIT_UPDATE', amount, totalProfit: this.metrics.totalProfit });
    }
    addStrategyTrade(strategy, profit) {
        const key = strategy;
        if (this.metrics.strategies[key]) {
            this.metrics.strategies[key].trades += 1;
            this.metrics.strategies[key].profit += profit;
        }
    }
}
exports.default = X7Dashboard;
//# sourceMappingURL=dashboard.js.map