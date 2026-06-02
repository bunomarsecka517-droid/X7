"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ethers_1 = require("ethers");
class OpportunityDetector {
    constructor() {
        this.opportunities = [];
        this.minConfidence = 0.72;
        this.minProfit = 200;
    }
    async detectLiquidations(events) {
        const liquidations = [];
        for (const event of events) {
            if (event.type !== 'LIQUIDATION')
                continue;
            const liquidation = {
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
    async detectSpreadArbitrages(prices) {
        const spreads = [];
        // Only detect if we have actual price data
        if (!prices || Object.keys(prices).length === 0)
            return spreads;
        return spreads;
    }
    async detectSandwichOpportunities(mempoolTxs) {
        const sandwiches = [];
        for (const tx of mempoolTxs) {
            if (tx.value && ethers_1.ethers.BigNumber.from(tx.value).gt(ethers_1.ethers.utils.parseEther('10'))) {
                const sandwich = {
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
    async detectFlashLoanArbitrages() {
        return [];
    }
    rankOpportunities(opportunities) {
        return opportunities
            .filter(opp => opp.profit > this.minProfit && opp.confidence > this.minConfidence)
            .sort((a, b) => (b.profit * b.confidence) - (a.profit * a.confidence))
            .slice(0, 30);
    }
}
exports.default = OpportunityDetector;
//# sourceMappingURL=opportunity-detector.js.map