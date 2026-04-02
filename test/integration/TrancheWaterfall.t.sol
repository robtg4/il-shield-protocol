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

contract TrancheWaterfallTest is Test {
    MockERC20 usdc;
    SeniorVault seniorVault;
    JuniorVault juniorVault;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");

    address depositor = makeAddr("depositor");
    address claimant = makeAddr("claimant");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        seniorVault = new SeniorVault(IERC20(address(usdc)), address(this));
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), address(this));

        seniorVault.grantRole(CORE_ROLE, address(this));
        juniorVault.grantRole(CORE_ROLE, address(this));

        // Seed Senior = 100_000e6
        deal(address(usdc), depositor, 125_000e6);
        vm.startPrank(depositor);
        usdc.approve(address(seniorVault), 100_000e6);
        seniorVault.deposit(100_000e6, depositor);
        usdc.approve(address(juniorVault), 25_000e6);
        juniorVault.deposit(25_000e6, depositor);
        vm.stopPrank();
    }

    /// @notice Waterfall helper: draw from Junior first, overflow to Senior
    function _executeClaim(uint256 amount) internal returns (uint256 actualTransferred) {
        uint256 balBefore = usdc.balanceOf(claimant);

        uint256 juniorAssets = juniorVault.totalAssets();
        if (amount <= juniorAssets) {
            juniorVault.withdrawForClaim(amount, claimant);
        } else {
            if (juniorAssets > 0) {
                juniorVault.withdrawForClaim(juniorAssets, claimant);
            }
            uint256 overflow = amount - juniorAssets;
            uint256 seniorAssets = seniorVault.totalAssets();
            uint256 seniorDraw = overflow > seniorAssets ? seniorAssets : overflow;
            if (seniorDraw > 0) {
                seniorVault.withdrawForClaim(seniorDraw, claimant);
            }
        }

        actualTransferred = usdc.balanceOf(claimant) - balBefore;
    }

    function test_waterfall_four_claims() public {
        // Initial: Junior=25_000e6, Senior=100_000e6
        assertApproxEqAbs(juniorVault.totalAssets(), 25_000e6, 1);
        assertApproxEqAbs(seniorVault.totalAssets(), 100_000e6, 1);

        // Claim 1: 10_000e6 from Junior
        _executeClaim(10_000e6);
        assertApproxEqAbs(juniorVault.totalAssets(), 15_000e6, 1, "C1: Junior");
        assertApproxEqAbs(seniorVault.totalAssets(), 100_000e6, 1, "C1: Senior");

        // Claim 2: 15_000e6 from Junior (exhausts it)
        _executeClaim(15_000e6);
        assertApproxEqAbs(juniorVault.totalAssets(), 0, 1, "C2: Junior");
        assertApproxEqAbs(seniorVault.totalAssets(), 100_000e6, 1, "C2: Senior");

        // Claim 3: 5_000e6 — Junior empty, draw from Senior
        _executeClaim(5_000e6);
        assertApproxEqAbs(juniorVault.totalAssets(), 0, 1, "C3: Junior");
        assertApproxEqAbs(seniorVault.totalAssets(), 95_000e6, 1, "C3: Senior");

        // Claim 4: 200_000e6 — both vaults empty, actual transfer = 95_000e6
        uint256 actual = _executeClaim(200_000e6);
        assertApproxEqAbs(juniorVault.totalAssets(), 0, 1, "C4: Junior");
        assertApproxEqAbs(seniorVault.totalAssets(), 0, 1, "C4: Senior");
        assertApproxEqAbs(actual, 95_000e6, 1, "C4: actual transfer");
    }
}
