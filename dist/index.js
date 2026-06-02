"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const data_ingest_1 = __importDefault(require("./services/data-ingest"));
const opportunity_detector_1 = __importDefault(require("./services/opportunity-detector"));
const execution_engine_1 = __importDefault(require("./services/execution-engine"));
const capital_manager_1 = __importDefault(require("./services/capital-manager"));
const dashboard_1 = __importDefault(require("./services/dashboard"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class X7ProtocolOrchestrator {
    constructor() {
        this.isRunning = false;
        this.rpcUrls = {
            mainnet: process.env.MAINNET_RPC || '',
            polygon: process.env.POLYGON_RPC || '',
            arbitrum: process.env.ARBITRUM_RPC || '',
            optimism: process.env.OPTIMISM_RPC || '',
            base: process.env.BASE_RPC || '',
            bsc: process.env.BSC_RPC || '',
        };
        this.chains = Object.keys(this.rpcUrls).filter(chain => this.rpcUrls[chain]);
        console.log('🚀 Initializing X7 Protocol Orchestrator...');
        console.log(`📍 Configured chains: ${this.chains.join(', ').toUpperCase()}`);
        console.log(`⚠️ Treasury: ${process.env.TREASURY_ADDRESS || 'Not configured'}`);
        this.dataIngest = new data_ingest_1.default(this.rpcUrls);
        this.opportunityDetector = new opportunity_detector_1.default();
        this.executionEngine = new execution_engine_1.default(this.rpcUrls, process.env.TREASURY_SIGNER_PRIVATE_KEY || '', process.env.PIMLICO_API_KEY || '');
        this.capitalManager = new capital_manager_1.default();
        this.dashboard = new dashboard_1.default(3000);
        this.start();
    }
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('📉 Starting data ingestion (optimized for low memory)...');
        await this.dataIngest.startMempoolMonitoring(this.chains.slice(0, 2));
        await this.dataIngest.monitorOnChainEvents(this.chains.slice(0, 2));
        console.log('👁️ Starting opportunity detection...');
        setInterval(async () => {
            try {
                await this.detectAndExecute();
            }
            catch (error) {
                console.error('Detection error:', error);
            }
        }, 5000);
        console.log('💰 Starting capital management...');
        setInterval(async () => {
            try {
                await this.manageCapital();
            }
            catch (error) {
                console.error('Capital management error:', error);
            }
        }, 60000);
        setTimeout(() => {
            console.log('🚀 Scaling to additional chains...');
            if (this.chains.length > 2) {
                this.dataIngest.startMempoolMonitoring(this.chains.slice(2, 4));
                this.dataIngest.monitorOnChainEvents(this.chains.slice(2, 4));
            }
        }, 30000);
        console.log('✅ X7 Protocol fully initialized and running');
    }
    async detectAndExecute() {
        const events = this.dataIngest.getEventQueue();
        if (events.length === 0)
            return;
        try {
            const liquidations = await this.opportunityDetector.detectLiquidations(events);
            for (const liq of liquidations.slice(0, 5)) {
                await this.execute(liq, 'liquidation');
            }
            const prices = await this.dataIngest.getPrices(['eth', 'usdc', 'dai']);
            const spreads = await this.opportunityDetector.detectSpreadArbitrages(prices);
            for (const spread of spreads.slice(0, 5)) {
                await this.execute(spread, 'spread');
            }
            const flashLoans = await this.opportunityDetector.detectFlashLoanArbitrages();
            for (const flashLoan of flashLoans.slice(0, 3)) {
                await this.execute(flashLoan, 'flashloan');
            }
            this.dataIngest.clearEventQueue();
        }
        catch (error) {
            console.error('Execution loop error:', error);
        }
    }
    async execute(opportunity, strategy) {
        try {
            const result = await this.executionEngine.executeViaFlashbots([opportunity], opportunity.chain);
            if (result.success) {
                const trade = {
                    type: strategy.toUpperCase(),
                    chain: opportunity.chain,
                    profit: opportunity.profit,
                    gas: result.gasUsed || 0,
                    timestamp: new Date().toISOString(),
                    txHash: result.txHash,
                };
                this.dashboard.recordTrade(trade);
                this.dashboard.updateProfit(opportunity.profit);
                this.dashboard.addStrategyTrade(strategy, opportunity.profit);
                this.capitalManager.updateDailyProfit(opportunity.profit);
                console.log(`✅ [${strategy.toUpperCase()}] on ${opportunity.chain}: +$${opportunity.profit.toFixed(2)}`);
            }
        }
        catch (error) {
            console.error(`[${strategy}] execution failed:`, error);
        }
    }
    async manageCapital() {
        try {
            const reinvestAmount = await this.capitalManager.calculateReinvestment();
            if (reinvestAmount > 0) {
                console.log(`💰 Auto-reinvesting: $${reinvestAmount.toFixed(2)}`);
                this.capitalManager.adjustReinvestmentPercentage(0.45);
            }
        }
        catch (error) {
            console.error('Capital management error:', error);
        }
    }
}
new X7ProtocolOrchestrator();
//# sourceMappingURL=index.js.map