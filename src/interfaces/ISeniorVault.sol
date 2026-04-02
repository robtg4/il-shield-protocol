// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface ISeniorVault is IERC4626 {
    event EmergencyWithdrawal(address indexed owner, uint256 shares, uint256 assets, uint256 penalty);
    event PremiumReceived(uint256 amount);
    event ClaimPaid(uint256 amount, address indexed to);

    error LockActive();
    error InWithdrawalQueue();

    function emergencyWithdraw(uint256 shares, address receiver) external;
    function withdrawForClaim(uint256 amount, address to) external;
    function receivePremium(uint256 amount) external;
    function depositBlock(address account) external view returns (uint256);
    function minLockDuration() external view returns (uint256);
    function emergencyWithdrawPenalty() external view returns (uint256);
}
