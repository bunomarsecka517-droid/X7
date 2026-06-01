// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IModemPay {
    function settleWithdrawal(address user, uint256 amount, address token) external returns (bool);
}

interface IPimlico {
    function canSponsorGas(address user, bytes memory data) external returns (bool);
}

contract X7TreasuryVault is ReentrancyGuard, Ownable {
    // State
    address public modemPayGateway;
    address public pimlico;
    address public treasury;
    
    uint256 public totalProfit;
    uint256 public totalWithdrawn;
    uint256 public reinvestmentPercentage = 40; // 40% default
    
    mapping(address => uint256) public profits;
    mapping(address => bool) public authorizedStrategies;
    
    // Events
    event ProfitAccumulated(address indexed strategy, uint256 amount, uint256 timestamp);
    event WithdrawalInitiated(address indexed user, uint256 amount, address token);
    event ReinvestmentDeployed(uint256 amount, address indexed strategy);
    event ReinvestmentPercentageUpdated(uint256 oldPercentage, uint256 newPercentage);
    event CircuitBreakerTriggered(string reason, uint256 timestamp);
    
    // Circuit breaker
    uint256 public lastDailyProfit;
    uint256 public dailyLossThreshold = 100 ether; // $100K
    uint256 public lastResetTime;
    bool public paused = false;
    
    constructor(address _modemPayGateway, address _pimlico, address _treasury) {
        modemPayGateway = _modemPayGateway;
        pimlico = _pimlico;
        treasury = _treasury;
        lastResetTime = block.timestamp;
    }
    
    // =========================
    // PROFIT ACCUMULATION
    // =========================
    
    receive() external payable {
        _accumulateProfit(msg.sender, msg.value);
    }
    
    function accumulateProfitERC20(
        address strategy,
        address token,
        uint256 amount
    ) external nonReentrant {
        require(authorizedStrategies[strategy], "Unauthorized strategy");
        require(amount > 0, "Amount must be > 0");
        
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _accumulateProfit(strategy, amount);
    }
    
    function _accumulateProfit(address strategy, uint256 amount) internal {
        require(!paused, "Treasury paused - circuit breaker active");
        
        totalProfit += amount;
        profits[strategy] += amount;
        
        _checkDailyLoss();
        _autoReinvest(amount);
        
        emit ProfitAccumulated(strategy, amount, block.timestamp);
    }
    
    // =========================
    // WITHDRAWAL VIA MODEM PAY
    // =========================
    
    function withdrawViaModemPay(
        uint256 amount,
        address token
    ) external nonReentrant returns (bool) {
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        
        // Approve Modem Pay to transfer
        IERC20(token).approve(modemPayGateway, amount);
        
        // Call Modem Pay settlement
        bool success = IModemPay(modemPayGateway).settleWithdrawal(msg.sender, amount, token);
        require(success, "Modem Pay settlement failed");
        
        totalWithdrawn += amount;
        emit WithdrawalInitiated(msg.sender, amount, token);
        
        return true;
    }
    
    // =========================
    // AUTO-REINVESTMENT (40% default)
    // =========================
    
    function _autoReinvest(uint256 profitAmount) internal {
        if (totalProfit % 24 hours == 0 && totalProfit > 0) {
            uint256 reinvestAmount = (profitAmount * reinvestmentPercentage) / 100;
            
            // Store for capital manager to pick up
            // In production: call CapitalManager.deployReinvestment(reinvestAmount)
            
            emit ReinvestmentDeployed(reinvestAmount, msg.sender);
        }
    }
    
    function updateReinvestmentPercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage >= 30 && newPercentage <= 50, "Invalid percentage");
        
        uint256 oldPercentage = reinvestmentPercentage;
        reinvestmentPercentage = newPercentage;
        
        emit ReinvestmentPercentageUpdated(oldPercentage, newPercentage);
    }
    
    // =========================
    // CIRCUIT BREAKER
    // =========================
    
    function _checkDailyLoss() internal {
        uint256 timeSinceReset = block.timestamp - lastResetTime;
        
        if (timeSinceReset >= 24 hours) {
            lastResetTime = block.timestamp;
            lastDailyProfit = 0;
            return;
        }
        
        if (totalProfit < lastDailyProfit) {
            uint256 dailyLoss = lastDailyProfit - totalProfit;
            if (dailyLoss > dailyLossThreshold) {
                paused = true;
                emit CircuitBreakerTriggered("Daily loss exceeded threshold", block.timestamp);
            }
        }
    }
    
    function resumeAfterCircuitBreaker() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        lastResetTime = block.timestamp;
    }
    
    // =========================
    // ADMIN
    // =========================
    
    function authorizeStrategy(address strategy) external onlyOwner {
        authorizedStrategies[strategy] = true;
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getERC20Balance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
