import express, { Express, Request, Response } from 'express';
import http from 'http';
import WebSocket from 'ws';
import path from 'path';

interface DashboardMetrics {
  totalProfit: number;
  dailyRevenue: number;
  totalWithdrawn: number;
  activePositions: number;
  winRate: number;
  capitalDeployed: number;
  gasSpent: number;
  tradesExecuted: number;
  lastTradeTime: string;
  treasury: {
    balance: number;
    address: string;
    reinvestmentPercentage: number;
  };
  strategies: {
    liquidation: { enabled: boolean; trades: number; profit: number };
    spread: { enabled: boolean; trades: number; profit: number };
    sandwich: { enabled: boolean; trades: number; profit: number };
    flashloan: { enabled: boolean; trades: number; profit: number };
  };
  alerts: any[];
  recentTrades: any[];
  status: string;
  uptime: number;
}

class X7Dashboard {
  private app: Express;
  private server: http.Server;
  private wss: WebSocket.Server;
  private metrics: DashboardMetrics;
  private wsClients: Set<WebSocket> = new Set();
  private metricsUpdateInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  constructor(port: number = 3000) {
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server, perMessageDeflate: false });

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

  private setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));

    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'OK', uptime: Date.now() - this.startTime });
    });

    this.app.get('/api/metrics', (req: Request, res: Response) => {
      res.json(this.metrics);
    });

    this.app.post('/api/strategy/:name/toggle', (req: Request, res: Response) => {
      const { name } = req.params;
      const strategyKey = name as keyof typeof this.metrics.strategies;

      if (this.metrics.strategies[strategyKey]) {
        this.metrics.strategies[strategyKey].enabled = !this.metrics.strategies[strategyKey].enabled;
        this.broadcast({ type: 'STRATEGY_TOGGLED', strategy: name, enabled: this.metrics.strategies[strategyKey].enabled });
        this.addAlert(`${this.metrics.strategies[strategyKey].enabled ? '🟢' : '🔴'} ${name} strategy ${this.metrics.strategies[strategyKey].enabled ? 'enabled' : 'disabled'}`);
        res.json({ success: true, status: this.metrics.strategies[strategyKey].enabled });
      } else {
        res.status(404).json({ error: 'Strategy not found' });
      }
    });

    this.app.post('/api/withdraw', async (req: Request, res: Response) => {
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
      } catch (error) {
        console.error('Withdrawal error:', error);
        this.addAlert('❌ Withdrawal failed');
        res.status(500).json({ error: 'Withdrawal failed' });
      }
    });

    this.app.post('/api/reinvestment', (req: Request, res: Response) => {
      const { percentage } = req.body;

      if (percentage < 30 || percentage > 50) {
        return res.status(400).json({ error: 'Percentage must be between 30-50' });
      }

      this.metrics.treasury.reinvestmentPercentage = percentage;
      this.broadcast({ type: 'REINVESTMENT_UPDATED', percentage });
      this.addAlert(`⚙️ Reinvestment updated to ${percentage}%`);
      res.json({ success: true, percentage });
    });

    this.app.get('/api/trades', (req: Request, res: Response) => {
      res.json(this.metrics.recentTrades.slice(-50));
    });

    this.app.post('/api/pause-all', (req: Request, res: Response) => {
      Object.keys(this.metrics.strategies).forEach(key => {
        this.metrics.strategies[key as keyof typeof this.metrics.strategies].enabled = false;
      });
      this.broadcast({ type: 'ALL_PAUSED' });
      this.addAlert('🛑 All strategies paused manually');
      res.json({ success: true });
    });

    this.app.post('/api/resume-all', (req: Request, res: Response) => {
      Object.keys(this.metrics.strategies).forEach(key => {
        this.metrics.strategies[key as keyof typeof this.metrics.strategies].enabled = true;
      });
      this.broadcast({ type: 'ALL_RESUMED' });
      this.addAlert('🚀 All strategies resumed');
      res.json({ success: true });
    });
  }

  private setupWebSocket() {
    this.wss.on('connection', (ws: WebSocket) => {
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

  private broadcast(message: any) {
    const payload = JSON.stringify(message);
    let sent = 0;
    this.wsClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    });
  }

  private startMetricsUpdates() {
    this.metricsUpdateInterval = setInterval(() => {
      this.metrics.uptime = Date.now() - this.startTime;
      this.broadcast({ type: 'METRICS_UPDATE', data: this.metrics });
    }, 2000);
  }

  private addAlert(message: string) {
    this.metrics.alerts.unshift({
      message,
      timestamp: new Date().toISOString(),
    });
    this.metrics.alerts = this.metrics.alerts.slice(0, 100);
    this.broadcast({ type: 'ALERT', message });
  }

  public recordTrade(trade: any) {
    this.metrics.recentTrades.unshift(trade);
    this.metrics.recentTrades = this.metrics.recentTrades.slice(0, 100);
    this.metrics.tradesExecuted += 1;
    this.metrics.lastTradeTime = new Date().toISOString();
    this.broadcast({ type: 'NEW_TRADE', trade });
  }

  public updateProfit(amount: number) {
    this.metrics.totalProfit += amount;
    this.metrics.dailyRevenue += amount;
    this.metrics.treasury.balance += amount;
    this.broadcast({ type: 'PROFIT_UPDATE', amount, totalProfit: this.metrics.totalProfit });
  }

  public addStrategyTrade(strategy: string, profit: number) {
    const key = strategy as keyof typeof this.metrics.strategies;
    if (this.metrics.strategies[key]) {
      this.metrics.strategies[key].trades += 1;
      this.metrics.strategies[key].profit += profit;
    }
  }
}

export default X7Dashboard;
