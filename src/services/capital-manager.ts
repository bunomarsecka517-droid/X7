import { ethers } from 'ethers';

class CapitalManager {
  private totalCapital: number = 0;
  private reinvestmentPercentage: number = 40;
  private capitalLog: any[] = [];
  private dailyProfit: number = 0;
  private lastResetTime: number = Date.now();

  updateDailyProfit(profit: number) {
    this.dailyProfit += profit;
    this.totalCapital += profit;
  }

  async calculateReinvestment(): Promise<number> {
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

  adjustReinvestmentPercentage(winRate: number) {
    if (winRate > 0.5) {
      this.reinvestmentPercentage = Math.min(50, this.reinvestmentPercentage + 2);
    } else if (winRate < 0.35) {
      this.reinvestmentPercentage = Math.max(30, this.reinvestmentPercentage - 2);
    }
  }

  getTotalCapital(): number {
    return this.totalCapital;
  }

  getCapitalLog(): any[] {
    return this.capitalLog;
  }
}

export default CapitalManager;
