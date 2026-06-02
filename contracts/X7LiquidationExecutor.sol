// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IAaveLendingPool {
    function liquidationCall(
        address collateral,
        address principal,
        address user,
        uint256 purchaseAmount,
        bool receiveAToken
    ) external;
}

contract X7LiquidationExecutor is ReentrancyGuard {
    address public aaveLendingPool;
    address public treasury;
    address public owner;
    
    mapping(address => uint256) public lastHealthCheck;
    uint256 public healthCheckInterval = 60 seconds;
    
    event LiquidationExecuted(address indexed user, address collateral, uint256 profit);
    event HealthFactorMonitored(address indexed user, uint256 healthFactor);
    
    constructor(address _aaveLendingPool, address _treasury) {
        aaveLendingPool = _aaveLendingPool;
        treasury = _treasury;
        owner = msg.sender;
    }
    
    function monitorAndLiquidate(
        address user,
        address collateral,
        address principal,
        uint256 debtAmount
    ) external nonReentrant returns (bool) {
        require(msg.sender == owner, "Unauthorized");
        
        // Check health factor (simplified)
        uint256 healthFactor = getHealthFactor(user);
        require(healthFactor < 1e18, "Position not liquidatable");
        
        // Approve principal token transfer
        IERC20(principal).approve(aaveLendingPool, debtAmount);
        
        // Execute liquidation
        IAaveLendingPool(aaveLendingPool).liquidationCall(
            collateral,
            principal,
            user,
            debtAmount,
            true
        );
        
        emit LiquidationExecuted(user, collateral, debtAmount);
        return true;
    }
    
    function getHealthFactor(address user) public view returns (uint256) {
        // Placeholder: in production, call Aave to get actual health factor
        return 1.5e18; // Example: 1.5
    }
}
