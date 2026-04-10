// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

interface IWETH {
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IERC20 {
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata) external payable returns (uint256);
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }
    function mint(MintParams calldata) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
    function balanceOf(address) external view returns (uint256);
    function tokenOfOwnerByIndex(address, uint256) external view returns (uint256);
}

interface IPool {
    function slot0() external view returns (uint160, int24, uint16, uint16, uint16, uint8, bool);
    function tickSpacing() external view returns (int24);
}

contract CreateTestLP is Script {
    address constant WETH       = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant POOL_USDC  = 0x6F79350e44a35225870e5fDDf55b17574Fd77d1a; // pool's token0
    address constant V3_POOL    = 0xE5E20F2977B83D39421E7B0c81f35C128e05d70d;
    address constant V3_PM      = 0x1238536071E1c677A632429e3655c799b22cDA52;
    // Uniswap v3 SwapRouter (original) on Sepolia
    address constant SWAP_ROUTER = 0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008;

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address wallet = vm.addr(key);

        // Read current tick to set a wide range
        (, int24 currentTick,,,,,) = IPool(V3_POOL).slot0();
        int24 tickSpacing = IPool(V3_POOL).tickSpacing();
        console.log("Current tick:", currentTick);
        console.log("Tick spacing:", tickSpacing);

        // Wide range: ±50 tick spacings from current
        int24 tickLower = ((currentTick - 50 * tickSpacing) / tickSpacing) * tickSpacing;
        int24 tickUpper = ((currentTick + 50 * tickSpacing) / tickSpacing) * tickSpacing;
        console.log("Tick lower:", tickLower);
        console.log("Tick upper:", tickUpper);

        uint256 wethBal = IWETH(WETH).balanceOf(wallet);
        console.log("WETH balance:", wethBal);

        vm.startBroadcast(key);

        // Step 1: Swap half WETH → pool USDC
        uint256 swapAmount = wethBal / 2; // 0.025 WETH
        console.log("Swapping WETH for pool USDC:", swapAmount);

        IWETH(WETH).approve(SWAP_ROUTER, swapAmount);
        uint256 usdcOut = ISwapRouter(SWAP_ROUTER).exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: WETH,
                tokenOut: POOL_USDC,
                fee: 3000,
                recipient: wallet,
                deadline: block.timestamp + 600,
                amountIn: swapAmount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            })
        );
        console.log("Got pool USDC:", usdcOut);

        // Step 2: Approve both tokens to NonfungiblePositionManager
        uint256 remainingWeth = IWETH(WETH).balanceOf(wallet);
        uint256 usdcBal = IERC20(POOL_USDC).balanceOf(wallet);
        console.log("Remaining WETH:", remainingWeth);
        console.log("Pool USDC bal:", usdcBal);

        IWETH(WETH).approve(V3_PM, remainingWeth);
        IERC20(POOL_USDC).approve(V3_PM, usdcBal);

        // Step 3: Mint LP position
        // token0 is POOL_USDC (lower address), token1 is WETH
        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) =
            INonfungiblePositionManager(V3_PM).mint(
                INonfungiblePositionManager.MintParams({
                    token0: POOL_USDC,
                    token1: WETH,
                    fee: 3000,
                    tickLower: tickLower,
                    tickUpper: tickUpper,
                    amount0Desired: usdcBal,
                    amount1Desired: remainingWeth,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: wallet,
                    deadline: block.timestamp + 600
                })
            );

        vm.stopBroadcast();

        console.log("");
        console.log("=== LP Position Created ===");
        console.log("Token ID:", tokenId);
        console.log("Liquidity:", liquidity);
        console.log("Amount0 (USDC):", amount0);
        console.log("Amount1 (WETH):", amount1);
        console.log("Tick lower:", tickLower);
        console.log("Tick upper:", tickUpper);
    }
}
