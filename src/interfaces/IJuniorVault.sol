// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IJuniorVault is IERC4626 {
    event PremiumReceived(uint256 amount);
    event ClaimPaid(uint256 amount, address indexed to);

    error LockActive();
    error WouldBreachSJRatio();

    function withdrawForClaim(uint256 amount, address to) external;
    function receivePremium(uint256 amount) external;
    function maxSeniorJuniorRatio() external view returns (uint256);
    function depositBlock(address account) external view returns (uint256);
    function minLockDuration() external view returns (uint256);
}
