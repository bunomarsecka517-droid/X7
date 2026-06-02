// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IModemPay {
    function settleWithdrawal(address user, uint256 amount, address token) external returns (bool);
}

contract X7TreasuryVault is ReentrancyGuard, Ownable {
    address public modemPayGateway;
    address public treasury;
    
    uint256 public totalProfit;
    uint256 public totalWithdrawn;
    uint256 public reinvestmentPercentage = 40;
    
    mapping(address => uint256) public profits;
    mapping(address => bool) public authorizedStrategies;
    
    event ProfitAccumulated(address indexed strategy, uint256 amount);
    event WithdrawalInitiated(address indexed user, uint256 amount, address token);
    event ReinvestmentDeployed(uint256 amount);
    event CircuitBreakerTriggered(string reason);
    
    uint256 public dailyLossThreshold = 100 ether;
    uint256 public lastResetTime;
    bool public paused = false;
    
    constructor(address _modemPayGateway, address _treasury) {
        modemPayGateway = _modemPayGateway;
        treasury = _treasury;
        lastResetTime = block.timestamp;
    }
    
    receive() external payable {
        _accumulateProfit(msg.sender, msg.value);
    }
    
    function accumulateProfitERC20(address strategy, address token, uint256 amount) external nonReentrant {
        require(authorizedStrategies[strategy], "Unauthorized strategy");
        require(amount > 0, "Amount must be > 0");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        _accumulateProfit(strategy, amount);
    }
    
    function _accumulateProfit(address strategy, uint256 amount) internal {
        require(!paused, "Treasury paused");
        totalProfit += amount;
        profits[strategy] += amount;
        _checkDailyLoss();
        _autoReinvest(amount);
        emit ProfitAccumulated(strategy, amount);
    }
    
    function withdrawViaModemPay(uint256 amount, address token) external nonReentrant returns (bool) {
        require(amount > 0, "Amount must be > 0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient balance");
        IERC20(token).approve(modemPayGateway, amount);
        bool success = IModemPay(modemPayGateway).settleWithdrawal(msg.sender, amount, token);
        require(success, "Modem Pay settlement failed");
        totalWithdrawn += amount;
        emit WithdrawalInitiated(msg.sender, amount, token);
        return true;
    }
    
    function _autoReinvest(uint256 profitAmount) internal {
        uint256 reinvestAmount = (profitAmount * reinvestmentPercentage) / 100;
        emit ReinvestmentDeployed(reinvestAmount);
    }
    
    function _checkDailyLoss() internal {
        uint256 timeSinceReset = block.timestamp - lastResetTime;
        if (timeSinceReset >= 24 hours) {
            lastResetTime = block.timestamp;
        }
    }
    
    function authorizeStrategy(address strategy) external onlyOwner {
        authorizedStrategies[strategy] = true;
    }
    
    function resumeAfterCircuitBreaker() external onlyOwner {
        paused = false;
    }
    
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
