// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract VaultHandler is Test {
    MockERC20 public usdc;
    SeniorVault public seniorVault;
    JuniorVault public juniorVault;

    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalClaims;
    uint256 public totalPremiums;

    address public depositor;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    uint256 constant SENIOR_LOCK = 100_800;
    uint256 constant JUNIOR_LOCK = 216_000;

    constructor(MockERC20 _usdc, SeniorVault _seniorVault, JuniorVault _juniorVault) {
        usdc = _usdc;
        seniorVault = _seniorVault;
        juniorVault = _juniorVault;
        depositor = makeAddr("handler_depositor");
    }

    function depositSenior(uint256 amount) external {
        amount = bound(amount, 1e6, 10_000e6);
        usdc.mint(depositor, amount);

        vm.startPrank(depositor);
        usdc.approve(address(seniorVault), amount);
        seniorVault.deposit(amount, depositor);
        vm.stopPrank();

        totalDeposited += amount;
    }

    function depositJunior(uint256 amount) external {
        amount = bound(amount, 1e6, 10_000e6);
        usdc.mint(depositor, amount);

        vm.startPrank(depositor);
        usdc.approve(address(juniorVault), amount);
        juniorVault.deposit(amount, depositor);
        vm.stopPrank();

        totalDeposited += amount;
    }

    function withdrawSenior(uint256 amount) external {
        uint256 maxAssets = seniorVault.maxWithdraw(depositor);
        if (maxAssets == 0) return;

        amount = bound(amount, 1, maxAssets);

        // Advance past lock
        vm.roll(block.number + SENIOR_LOCK + 1);

        vm.startPrank(depositor);
        seniorVault.withdraw(amount, depositor, depositor);
        vm.stopPrank();

        totalWithdrawn += amount;
    }

    function withdrawJunior(uint256 amount) external {
        uint256 maxAssets = juniorVault.maxWithdraw(depositor);
        if (maxAssets == 0) return;

        amount = bound(amount, 1, maxAssets);

        // Advance past lock
        vm.roll(block.number + JUNIOR_LOCK + 1);

        vm.startPrank(depositor);
        // This may revert due to SJ ratio — that's fine, we just skip
        try juniorVault.withdraw(amount, depositor, depositor) {
            totalWithdrawn += amount;
        } catch {}
        vm.stopPrank();
    }

    function receivePremiumSenior(uint256 amount) external {
        amount = bound(amount, 1e6, 1_000e6);
        usdc.mint(address(this), amount);
        usdc.approve(address(seniorVault), amount);
        seniorVault.receivePremium(amount);

        totalPremiums += amount;
    }

    function receivePremiumJunior(uint256 amount) external {
        amount = bound(amount, 1e6, 1_000e6);
        usdc.mint(address(this), amount);
        usdc.approve(address(juniorVault), amount);
        juniorVault.receivePremium(amount);

        totalPremiums += amount;
    }

    function withdrawForClaimJunior(uint256 amount) external {
        amount = bound(amount, 1e6, 5_000e6);
        uint256 juniorAssets = juniorVault.totalAssets();
        uint256 actualClaim = amount > juniorAssets ? juniorAssets : amount;

        if (actualClaim == 0) return;

        address recipient = makeAddr("claim_recipient");
        juniorVault.withdrawForClaim(amount, recipient);

        totalClaims += actualClaim;
    }

    function withdrawForClaimSenior(uint256 amount) external {
        amount = bound(amount, 1e6, 5_000e6);
        uint256 seniorAssets = seniorVault.totalAssets();
        if (seniorAssets == 0) return;

        uint256 actualClaim = amount > seniorAssets ? seniorAssets : amount;
        address recipient = makeAddr("claim_recipient");
        seniorVault.withdrawForClaim(actualClaim, recipient);

        totalClaims += actualClaim;
    }
}

contract VaultSolvencyTest is Test {
    MockERC20 usdc;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    VaultHandler handler;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        seniorVault = new SeniorVault(IERC20(address(usdc)), address(this));
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), address(this));

        seniorVault.grantRole(CORE_ROLE, address(this));
        juniorVault.grantRole(CORE_ROLE, address(this));

        handler = new VaultHandler(usdc, seniorVault, juniorVault);

        // Grant CORE_ROLE to handler so it can call receivePremium and withdrawForClaim
        seniorVault.grantRole(CORE_ROLE, address(handler));
        juniorVault.grantRole(CORE_ROLE, address(handler));

        targetContract(address(handler));
    }

    function invariant_solvency() public view {
        uint256 vaultAssets = seniorVault.totalAssets() + juniorVault.totalAssets();
        // Account for withdrawn USDC sitting in depositor's wallet
        uint256 expectedInVaults =
            handler.totalDeposited() + handler.totalPremiums() - handler.totalWithdrawn() - handler.totalClaims();

        assertApproxEqAbs(vaultAssets, expectedInVaults, 1, "Solvency invariant broken");
    }
}
