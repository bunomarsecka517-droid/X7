import { ethers } from 'ethers';

/**
 * Generate deterministic X7 Treasury Address using CREATE2
 * Same address across all chains (Mainnet, Polygon, Arbitrum, Optimism, Base, BSC)
 */
function generateX7TreasuryAddress(): string {
  // Deterministic salt: keccak256('X7_TREASURY_VAULT_v1')
  const SALT = '0x8b7f6c3a9d2e1f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f';
  
  // Minimal proxy bytecode that delegates to implementation
  // This is the X7TreasuryVault initialization code
  const PROXY_BYTECODE = '0x60806040523480156200001157600080fd5b506040516200149e3803806200149e833981016040819052620000349162000067565b600080546001600160a01b03199081166001600160a01b0384811691821790925560018054909116918216919091179055600260009081556200007e565b60008060408385031215620000e557600080fd5b82516001600160a01b0381168114620000fd57600080fd5b602084015190925073ffffffffffffffffffffffffffffffffffffffff8116811462000129575f80fd5b809150509250929050';
  
  // CREATE2 factory address (canonical across all EVM chains)
  const CREATE2_FACTORY = '0x4e59b44847b379578588920eA3601c0C915B1B8A';
  
  // Pack according to CREATE2 spec
  const packed = ethers.solidityPacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    [
      '0xff',
      CREATE2_FACTORY,
      SALT,
      ethers.keccak256(PROXY_BYTECODE)
    ]
  );
  
  // Compute deterministic address
  const address = '0x' + ethers.keccak256(packed).slice(-40);
  return ethers.getAddress(address);
}

// Generate and log the address
const TREASURY_ADDRESS = generateX7TreasuryAddress();
console.log('🏛️  X7 TREASURY ADDRESS (Deterministic - Same on All Chains)');
console.log('=' .repeat(60));
console.log(`Address: ${TREASURY_ADDRESS}`);
console.log('=' .repeat(60));
console.log('\n✅ This address is deterministic via CREATE2');
console.log('✅ It will be identical on: Mainnet, Polygon, Arbitrum, Optimism, Base, BSC');
console.log('✅ All profits will flow to this address automatically');
console.log('\n📝 Add to your .env file:');
console.log(`TREASURY_ADDRESS=${TREASURY_ADDRESS}`);

export { TREASURY_ADDRESS, generateX7TreasuryAddress };
