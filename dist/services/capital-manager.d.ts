declare class CapitalManager {
    private totalCapital;
    private reinvestmentPercentage;
    private capitalLog;
    private dailyProfit;
    private lastResetTime;
    updateDailyProfit(profit: number): void;
    calculateReinvestment(): Promise<number>;
    adjustReinvestmentPercentage(winRate: number): void;
    getTotalCapital(): number;
    getCapitalLog(): any[];
}
export default CapitalManager;
//# sourceMappingURL=capital-manager.d.ts.map