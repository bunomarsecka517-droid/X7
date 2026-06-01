// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IFlashLoanReceiver {
    function executeOperation(address asset, uint256 amount, uint256 premium, address initiator, bytes calldata params) external returns (bytes32);
}

interface IAavePool {
    function flashLoan(address token, uint256 amount, address onBehalfOf, bytes calldata params, uint16 referralCode) external;
}

contract X7FlashLoanRouter is ReentrancyGuard, IFlashLoanReceiver {
    address public aavePool;
    address public treasury;
    address public owner;
    
    mapping(address => bool) public whitelistedTokens;
    
    event FlashLoanExecuted(address indexed token, uint256 amount, uint256 premium);
    event ProfitTransferred(uint256 amount);
    
    constructor(address _aavePool, address _treasury) {
        aavePool = _aavePool;
        treasury = _treasury;
        owner = msg.sender;
    }
    
    function executeFlashLoan(
        address token,
        uint256 amount,
        bytes calldata data
    ) external nonReentrant returns (bool) {
        require(whitelistedTokens[token], "Token not whitelisted");
        IAavePool(aavePool).flashLoan(token, amount, address(this), data, 0);
        return true;
    }
    
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bytes32) {
        require(msg.sender == aavePool, "Unauthorized caller");
        
        // Execute user callback
        (bool success, ) = address(this).call(params);
        require(success, "Execution failed");
        
        // Approve repayment
        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(aavePool, amountOwed);
        
        emit FlashLoanExecuted(asset, amount, premium);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
    
    function whitelistToken(address token) external {
        require(msg.sender == owner, "Unauthorized");
        whitelistedTokens[token] = true;
    }
    
    function estimateFlashLoanFee(address token, uint256 amount) external view returns (uint256) {
        // Aave: 0.05% fee
        return (amount * 5) / 10000;
    }
}
