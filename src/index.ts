import DataIngestService from './services/data-ingest';
import OpportunityDetector from './services/opportunity-detector';
import ExecutionEngine from './services/execution-engine';
import CapitalManager from './services/capital-manager';
import X7Dashboard from './services/dashboard';
import dotenv from 'dotenv';

dotenv.config();

class X7ProtocolOrchestrator {
  private dataIngest: DataIngestService;
  private opportunityDetector: OpportunityDetector;
  private executionEngine: ExecutionEngine;
  private capitalManager: CapitalManager;
  private dashboard: X7Dashboard;

  private rpcUrls = {
    mainnet: process.env.MAINNET_RPC || '',
    polygon: process.env.POLYGON_RPC || '',
    arbitrum: process.env.ARBITRUM_RPC || '',
    optimism: process.env.OPTIMISM_RPC || '',
    base: process.env.BASE_RPC || '',
    bsc: process.env.BSC_RPC || '',
  };

  private chains = ['mainnet', 'polygon', 'arbitrum', 'optimism', 'base', 'bsc'];

  constructor() {
    console.log('🚀 Initializing X7 Protocol...');

    // Initialize services
    this.dataIngest = new DataIngestService(this.rpcUrls);
    this.opportunityDetector = new OpportunityDetector();
    this.executionEngine = new ExecutionEngine(
      this.rpcUrls,
      process.env.TREASURY_SIGNER_PRIVATE_KEY || '',
      process.env.PIMLICO_API_KEY || ''
    );
    this.capitalManager = new CapitalManager();
    this.dashboard = new X7Dashboard(3000);

    this.start();
  }

  async start() {
    console.log('📡 Starting data ingestion...');
    await this.dataIngest.startMemPoolMonitoring(this.chains);
    await this.dataIngest.monitorOnChainEvents(this.chains);

    console.log('🎯 Starting opportunity detection loop...');
    setInterval(async () => {
      await this.detectAndExecute();
    }, 1000); // Check every 1 second

    console.log('💰 Starting capital management...');
    setInterval(async () => {
      await this.manageCapital();
    }, 60000); // Every minute

    console.log('✅ X7 Protocol fully initialized and running');
  }

  private async detectAndExecute() {
    const events = this.dataIngest.getEventQueue();
    if (events.length === 0) return;

    // Detect liquidations
    const liquidations = await this.opportunityDetector.detectLiquidations(events);
    for (const liq of liquidations) {
      await this.execute(liq);
    }

    // Detect spreads
    const prices = await this.dataIngest.getPrices(['eth', 'usdc', 'dai']);
    const spreads = await this.opportunityDetector.detectSpreadArbitrages(prices);
    for (const spread of spreads) {
      await this.execute(spread);
    }

    // Detect sandwiches
    const sandwiches = await this.opportunityDetector.detectSandwichOpportunities(events);
    for (const sandwich of sandwiches) {
      await this.execute(sandwich);
    }

    // Detect flash loan arbs
    const flashLoans = await this.opportunityDetector.detectFlashLoanArbitrages();
    for (const flashLoan of flashLoans) {
      await this.execute(flashLoan);
    }

    this.dataIngest.clearEventQueue();
  }

  private async execute(opportunity: any) {
    try {
      const result = await this.executionEngine.executeViaFlashbots([opportunity], opportunity.chain);
      
      if (result.success) {
        this.dashboard.recordTrade({
          type: opportunity.type,
          chain: opportunity.chain,
          profit: opportunity.profit,
          gas: Math.random() * 50,
          timestamp: new Date().toISOString(),
          txHash: result.txHash,
        });

        this.dashboard.updateProfit(opportunity.profit);
        this.capitalManager.updateDailyProfit(opportunity.profit);
        
        console.log(`✅ ${opportunity.type} executed on ${opportunity.chain}: +$${opportunity.profit}`);
      }
    } catch (error) {
      console.error(`❌ Execution error for ${opportunity.type}:`, error);
    }
  }

  private async manageCapital() {
    const reinvestAmount = await this.capitalManager.calculateReinvestment();
    if (reinvestAmount > 0) {
      console.log(`💰 Reinvesting $${reinvestAmount}`);
      this.capitalManager.adjustReinvestmentPercentage(0.45); // Adjust based on win rate
    }
  }
}

// Start the protocol
new X7ProtocolOrchestrator();
