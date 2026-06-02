import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const networks = ['polygon', 'mainnet', 'arbitrum', 'optimism', 'base', 'bsc'];
const contractName = 'X7TreasuryVault';

async function deploy() {
  console.log('🚀 Deploying X7 to all chains...');
  
  for (const network of networks) {
    console.log(`\n📦 Deploying to ${network.toUpperCase()}...`);
    
    return new Promise((resolve, reject) => {
      exec(
        `NETWORK=${network} hardhat run scripts/deploy-contracts.ts --network ${network}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ ${network} deployment failed:`, error);
            reject(error);
          } else {
            console.log(`✅ ${network} deployment successful`);
            console.log(stdout);
            resolve(null);
          }
        }
      );
    });
  }
  
  console.log('\n✅ All chains deployed successfully!');
}

deploy().catch(console.error);
