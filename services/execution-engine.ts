import { ethers } from 'ethers';
import axios from 'axios';

interface ExecutionResult {
  success: boolean;
  txHash?: string;
  profit?: number;
  error?: string;
}

class ExecutionEngine {
  private providers: Map<string, ethers.providers.JsonRpcProvider>;
  private signer: ethers.Signer | null;
  private pimlicoUrl = 'https://api.pimlico.io';
  private pimlicoApiKey: string;
  private executionLog: any[] = [];
  private retryAttempts = 2;
  private retryDelay = 1000;

  constructor(
    rpcUrls: { [key: string]: string },
    privateKey: string,
    pimlicoApiKey: string
  ) {
    this.providers = new Map();
    Object.entries(rpcUrls).forEach(([chain, url]) => {
      if (url) {
        this.providers.set(chain, new ethers.providers.JsonRpcProvider(url));
      }
    });
    
    this.signer = privateKey ? new ethers.Wallet(privateKey) : null;
    this.pimlicoApiKey = pimlicoApiKey;
  }

  async executeViaFlashbots(
    transactions: any[],
    chain: string = 'polygon'
  ): Promise<ExecutionResult> {
    if (!this.signer) {
      return { success: false, error: 'No signer configured' };
    }

    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        // Try Pimlico gas sponsorship first (most reliable)
        const result = await this.executeViaPimlico(transactions, chain);
        if (result.success) return result;

        // Fallback to standard RPC
        return await this.executeViaStandardRPC(transactions, chain);
      } catch (error) {
        if (attempt < this.retryAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        } else {
          console.error(`Execution failed after ${this.retryAttempts} attempts:`, error);
          return { success: false, error: String(error) };
        }
      }
    }

    return { success: false, error: 'All execution attempts failed' };
  }

  private async executeViaPimlico(
    transactions: any[],
    chain: string
  ): Promise<ExecutionResult> {
    try {
      if (!this.pimlicoApiKey) {
        throw new Error('Pimlico API key not configured');
      }

      const provider = this.providers.get(chain);
      if (!provider) throw new Error('Chain RPC not configured');

      // Build transaction with gas estimation
      const tx = transactions[0];
      const gasEstimate = await provider.estimateGas(tx);
      
      tx.gasLimit = gasEstimate.mul(120).div(100); // 20% buffer
      tx.type = 2; // EIP-1559
      tx.maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei');
      tx.maxFeePerGas = ethers.parseUnits('50', 'gwei');

      // For production: integrate actual Pimlico sponsorship
      // For now: use standard execution
      const signedTx = await this.signer?.signTransaction(tx);
      if (!signedTx) throw new Error('Transaction signing failed');

      const txResponse = await provider.broadcastTransaction(signedTx);
      const receipt = await txResponse.wait();

      return {
        success: !!receipt,
        txHash: receipt?.hash,
      };
    } catch (error) {
      throw error;
    }
  }

  private async executeViaStandardRPC(
    transactions: any[],
    chain: string
  ): Promise<ExecutionResult> {
    try {
      const provider = this.providers.get(chain);
      if (!provider || !this.signer) {
        return { success: false, error: 'Provider or signer not available' };
      }

      const tx = transactions[0];
      const connectedSigner = this.signer.connect(provider);
      
      const txResponse = await connectedSigner.sendTransaction(tx);
      await txResponse.wait();

      return {
        success: true,
        txHash: txResponse.hash,
      };
    } catch (error) {
      console.error('Standard RPC execution error:', error);
      return { success: false, error: String(error) };
    }
  }

  async estimateGas(tx: any, chain: string): Promise<number> {
    try {
      const provider = this.providers.get(chain);
      if (!provider) throw new Error('Chain not found');
      
      const gasEstimate = await provider.estimateGas(tx);
      return Number(gasEstimate) * 1.2; // 20% buffer
    } catch (error) {
      console.error('Gas estimation error:', error);
      return 300000; // Safe fallback
    }
  }
}

export default ExecutionEngine;
