"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CapitalManager {
    constructor() {
        this.totalCapital = 0;
        this.reinvestmentPercentage = 40;
        this.capitalLog = [];
        this.dailyProfit = 0;
        this.lastResetTime = Date.now();
    }
    updateDailyProfit(profit) {
        this.dailyProfit += profit;
        this.totalCapital += profit;
    }
    async calculateReinvestment() {
        const timeSinceReset = Date.now() - this.lastResetTime;
        if (timeSinceReset >= 24 * 60 * 60 * 1000) {
            const reinvestAmount = (this.dailyProfit * this.reinvestmentPercentage) / 100;
            this.capitalLog.push({
                timestamp: Date.now(),
                profit: this.dailyProfit,
                reinvested: reinvestAmount,
                available: this.dailyProfit - reinvestAmount,
            });
            this.dailyProfit = 0;
            this.lastResetTime = Date.now();
            return reinvestAmount;
        }
        return 0;
    }
    adjustReinvestmentPercentage(winRate) {
        if (winRate > 0.5) {
            this.reinvestmentPercentage = Math.min(50, this.reinvestmentPercentage + 2);
        }
        else if (winRate < 0.35) {
            this.reinvestmentPercentage = Math.max(30, this.reinvestmentPercentage - 2);
        }
    }
    getTotalCapital() {
        return this.totalCapital;
    }
    getCapitalLog() {
        return this.capitalLog;
    }
}
exports.default = CapitalManager;
//# sourceMappingURL=capital-manager.js.map