import { ethers } from 'ethers';

interface Opportunity {
  id: string;
  type: 'LIQUIDATION' | 'SPREAD_ARB' | 'SANDWICH' | 'FLASH_LOAN';
  chain: string;
  profit: number;
  confidence: number;
  data: any;
  timestamp: number;
}

class OpportunityDetector {
  private opportunities: Opportunity[] = [];
  private minConfidence = 0.72;
  private minProfit = 200;

  async detectLiquidations(events: any[]): Promise<Opportunity[]> {
    const liquidations: Opportunity[] = [];

    for (const event of events) {
      if (event.type !== 'LIQUIDATION') continue;

      const liquidation: Opportunity = {
        id: `liq_${event.chain}_${Date.now()}`,
        type: 'LIQUIDATION',
        chain: event.chain,
        profit: event.data?.profit || 0,
        confidence: event.data?.confidence || 0.85,
        data: event.log,
        timestamp: Date.now(),
      };

      if (liquidation.profit > this.minProfit && liquidation.confidence > this.minConfidence) {
        liquidations.push(liquidation);
      }
    }

    return liquidations;
  }

  async detectSpreadArbitrages(prices: { [key: string]: number }): Promise<Opportunity[]> {
    const spreads: Opportunity[] = [];
    
    // Only detect if we have actual price data
    if (!prices || Object.keys(prices).length === 0) return spreads;

    return spreads;
  }

  async detectSandwichOpportunities(mempoolTxs: any[]): Promise<Opportunity[]> {
    const sandwiches: Opportunity[] = [];

    for (const tx of mempoolTxs) {
      if (tx.value && ethers.BigNumber.from(tx.value).gt(ethers.utils.parseEther('10'))) {
        const sandwich: Opportunity = {
          id: `sandwich_${tx.hash}`,
          type: 'SANDWICH',
          chain: 'mainnet',
          profit: tx.data?.profit || 0,
          confidence: tx.data?.confidence || 0.7,
          data: tx,
          timestamp: Date.now(),
        };

        if (sandwich.profit > this.minProfit && sandwich.confidence > this.minConfidence) {
          sandwiches.push(sandwich);
        }
      }
    }

    return sandwiches;
  }

  async detectFlashLoanArbitrages(): Promise<Opportunity[]> {
    return [];
  }

  rankOpportunities(opportunities: Opportunity[]): Opportunity[] {
    return opportunities
      .filter(opp => opp.profit > this.minProfit && opp.confidence > this.minConfidence)
      .sort((a, b) => (b.profit * b.confidence) - (a.profit * a.confidence))
      .slice(0, 30);
  }
}

export default OpportunityDetector;
