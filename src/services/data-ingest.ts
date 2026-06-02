import { ethers } from 'ethers';
import axios from 'axios';

interface DataSource {
  name: string;
  url: string;
  interval: number;
}

class DataIngestService {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private eventQueue: any[] = [];
  private dataSources: DataSource[] = [];

  constructor(rpcUrls: { [key: string]: string }) {
    this.providers = new Map();
    Object.entries(rpcUrls).forEach(([chain, url]) => {
      if (url) {
        this.providers.set(chain, new ethers.providers.JsonRpcProvider(url));
      }
    });
  }

  async startMempoolMonitoring(chains: string[]) {
    for (const chain of chains) {
      const provider = this.providers.get(chain);
      if (!provider) continue;

      provider.on('pending', async (txHash) => {
        try {
          const tx = await provider.getTransaction(txHash);
          if (tx && tx.value && ethers.BigNumber.from(tx.value).gt(ethers.utils.parseEther('1'))) {
            this.eventQueue.push({
              type: 'MEMPOOL_TX',
              chain,
              tx,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          console.error(`[${chain}] Mempool monitoring error:`, error);
        }
      });
    }
  }

  async monitorOnChainEvents(chains: string[]) {
    const AAVE_LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
    const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    for (const chain of chains) {
      const provider = this.providers.get(chain);
      if (!provider) continue;

      const aaveFilter = {
        address: AAVE_LENDING_POOL,
        topics: [ethers.utils.id('LiquidationCall(address,address,address,uint256,uint256,address,bool)')],
      };

      provider.on(aaveFilter, (log) => {
        this.eventQueue.push({
          type: 'LIQUIDATION',
          chain,
          log,
          timestamp: Date.now(),
        });
      });

      const uniswapFilter = {
        address: UNISWAP_ROUTER,
        topics: [ethers.utils.id('Swap(bytes32,uint256,uint256,uint160,uint128,int24)')],
      };

      provider.on(uniswapFilter, (log) => {
        this.eventQueue.push({
          type: 'SWAP',
          chain,
          log,
          timestamp: Date.now(),
        });
      });
    }
  }

  async getPrices(tokens: string[]): Promise<{ [key: string]: number }> {
    const prices: { [key: string]: number } = {};
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: tokens.join(','),
          vs_currencies: 'usd',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Price fetch error:', error);
      return prices;
    }
  }

  getEventQueue(): any[] {
    return this.eventQueue;
  }

  clearEventQueue() {
    this.eventQueue = [];
  }
}

export default DataIngestService;
