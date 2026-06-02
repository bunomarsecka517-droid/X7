declare class X7Dashboard {
    private app;
    private server;
    private wss;
    private metrics;
    private wsClients;
    private metricsUpdateInterval;
    private startTime;
    constructor(port?: number);
    private setupRoutes;
    private setupWebSocket;
    private broadcast;
    private startMetricsUpdates;
    private addAlert;
    recordTrade(trade: any): void;
    updateProfit(amount: number): void;
    addStrategyTrade(strategy: string, profit: number): void;
}
export default X7Dashboard;
//# sourceMappingURL=dashboard.d.ts.map