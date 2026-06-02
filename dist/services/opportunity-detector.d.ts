interface Opportunity {
    id: string;
    type: 'LIQUIDATION' | 'SPREAD_ARB' | 'SANDWICH' | 'FLASH_LOAN';
    chain: string;
    profit: number;
    confidence: number;
    data: any;
    timestamp: number;
}
declare class OpportunityDetector {
    private opportunities;
    private minConfidence;
    private minProfit;
    detectLiquidations(events: any[]): Promise<Opportunity[]>;
    detectSpreadArbitrages(prices: {
        [key: string]: number;
    }): Promise<Opportunity[]>;
    detectSandwichOpportunities(mempoolTxs: any[]): Promise<Opportunity[]>;
    detectFlashLoanArbitrages(): Promise<Opportunity[]>;
    rankOpportunities(opportunities: Opportunity[]): Opportunity[];
}
export default OpportunityDetector;
//# sourceMappingURL=opportunity-detector.d.ts.map