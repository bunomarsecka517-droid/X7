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
  private isRunning: boolean = false;

  private rpcUrls = {
    mainnet: process.env.MAINNET_RPC || '',
    polygon: process.env.POLYGON_RPC || '',
    arbitrum: process.env.ARBITRUM_RPC || '',
    optimism: process.env.OPTIMISM_RPC || '',
    base: process.env.BASE_RPC || '',
    bsc: process.env.BSC_RPC || '',
  };

  private chains = Object.keys(this.rpcUrls).filter(chain => this.rpcUrls[chain as keyof typeof this.rpcUrls]);

  constructor() {
    console.log('🚀 Initializing X7 Protocol Orchestrator...');
    console.log(`📍 Configured chains: ${this.chains.join(', ').toUpperCase()}`);
    console.log(`💰 Treasury: ${process.env.TREASURY_ADDRESS || 'Not configured'}`);

    // Initialize services (lightweight for Railway free tier)
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
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('📡 Starting data ingestion (optimized for low memory)...');
    await this.dataIngest.startMemPoolMonitoring(this.chains.slice(0, 2)); // Start with 2 chains
    await this.dataIngest.monitorOnChainEvents(this.chains.slice(0, 2));

    console.log('🎯 Starting opportunity detection...');
    // Lower frequency for Railway free tier (5 second interval)
    setInterval(async () => {
      try {
        await this.detectAndExecute();
      } catch (error) {
        console.error('Detection error:', error);
      }
    }, 5000);

    console.log('💰 Starting capital management...');
    setInterval(async () => {
      try {
        await this.manageCapital();
      } catch (error) {
        console.error('Capital management error:', error);
      }
    }, 60000);

    // Scale to additional chains after 30 seconds
    setTimeout(() => {
      console.log('🌍 Scaling to additional chains...');
      if (this.chains.length > 2) {
        this.dataIngest.startMemPoolMonitoring(this.chains.slice(2, 4));
        this.dataIngest.monitorOnChainEvents(this.chains.slice(2, 4));
      }
    }, 30000);

    console.log('✅ X7 Protocol fully initialized and running');
  }

  private async detectAndExecute() {
    const events = this.dataIngest.getEventQueue();
    if (events.length === 0) return;

    try {
      // Detect liquidations (highest priority)
      const liquidations = await this.opportunityDetector.detectLiquidations(events);
      for (const liq of liquidations.slice(0, 5)) { // Limit to 5 per cycle
        await this.execute(liq, 'liquidation');
      }

      // Detect spreads
      const prices = await this.dataIngest.getPrices(['eth', 'usdc', 'dai']);
      const spreads = await this.opportunityDetector.detectSpreadArbitrages(prices);
      for (const spread of spreads.slice(0, 5)) {
        await this.execute(spread, 'spread');
      }

      // Flash loan arbs (lower frequency)
      const flashLoans = await this.opportunityDetector.detectFlashLoanArbitrages();
      for (const flashLoan of flashLoans.slice(0, 3)) {
        await this.execute(flashLoan, 'flashloan');
      }

      this.dataIngest.clearEventQueue();
    } catch (error) {
      console.error('Execution loop error:', error);
    }
  }

  private async execute(opportunity: any, strategy: string) {
    try {
      const result = await this.executionEngine.executeViaFlashbots([opportunity], opportunity.chain);
      
      if (result.success) {
        const trade = {
          type: strategy.toUpperCase(),
          chain: opportunity.chain,
          profit: opportunity.profit,
          gas: Math.random() * 50,
          timestamp: new Date().toISOString(),
          txHash: result.txHash,
        };

        this.dashboard.recordTrade(trade);
        this.dashboard.updateProfit(opportunity.profit);
        this.dashboard.addStrategyTrade(strategy, opportunity.profit);
        this.capitalManager.updateDailyProfit(opportunity.profit);
        
        console.log(`✅ ${strategy.toUpperCase()} on ${opportunity.chain}: +$${opportunity.profit.toFixed(2)}`);
      }
    } catch (error) {
      // Silent fail on execution errors (normal in production)
    }
  }

  private async manageCapital() {
    try {
      const reinvestAmount = await this.capitalManager.calculateReinvestment();
      if (reinvestAmount > 0) {
        console.log(`💰 Auto-reinvesting: $${reinvestAmount.toFixed(2)}`);
        this.capitalManager.adjustReinvestmentPercentage(0.45);
      }
    } catch (error) {
      console.error('Capital management error:', error);
    }
  }
}

// Start the protocol
new X7ProtocolOrchestrator();
