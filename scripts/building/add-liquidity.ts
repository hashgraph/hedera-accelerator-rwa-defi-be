import { ethers } from "hardhat";
import { UniswapV2Router02, UniswapV2Factory } from "../../typechain-types";
import { uniswapRouterAddress, uniswapFactoryAddress, usdcAddress } from "../../constants";
import { promptBuilding } from "./prompt-building";

// Description: 💧 - Add liquidity to the uniswap pool
async function main() {
    console.log("💧 Add Liquidity Script");
    console.log("======================");

    // Prompt user for building address, else use first building from building factory
    const buildingDetails = await promptBuilding();

    const buildingTokenAddress = buildingDetails.erc3643Token;

    // Configuration - Update these addresses for your deployment
    const UNISWAP_ROUTER_ADDRESS = uniswapRouterAddress; // Update with actual router address
    const UNISWAP_FACTORY_ADDRESS = uniswapFactoryAddress; // Update with actual factory address
    const USDC_ADDRESS = usdcAddress; // Update with actual USDC address
    const BUILDING_TOKEN_ADDRESS = buildingTokenAddress; // Update with building token address

    // Liquidity amounts (adjust as needed)
    const BUILDING_TOKEN_AMOUNT = ethers.parseEther("1000"); // 1000 building tokens
    const USDC_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)

    // Slippage tolerance (0.5% = 50 basis points)
    const SLIPPAGE_TOLERANCE = 50;

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address);

    // Get contracts
    const uniswapRouter = (await ethers.getContractAt(
        "UniswapV2Router02",
        UNISWAP_ROUTER_ADDRESS,
    )) as UniswapV2Router02;
    const uniswapFactory = (await ethers.getContractAt(
        "UniswapV2Factory",
        UNISWAP_FACTORY_ADDRESS,
    )) as UniswapV2Factory;
    const usdc = await ethers.getContractAt("ERC20Mock", USDC_ADDRESS);
    const buildingToken = await ethers.getContractAt("ERC20Mock", BUILDING_TOKEN_ADDRESS);

    console.log("\n📋 Configuration");
    console.log("================");
    console.log("Uniswap Router:", UNISWAP_ROUTER_ADDRESS);
    console.log("Uniswap Factory:", UNISWAP_FACTORY_ADDRESS);
    console.log("USDC Address:", USDC_ADDRESS);
    console.log("Building Token Address:", BUILDING_TOKEN_ADDRESS);
    console.log("Building Token Amount:", ethers.formatEther(BUILDING_TOKEN_AMOUNT));
    console.log("USDC Amount:", ethers.formatUnits(USDC_AMOUNT, 6));
    console.log("Slippage Tolerance:", SLIPPAGE_TOLERANCE, "basis points");

    // Check if pair already exists
    console.log("\n🔍 Checking Pair Status");
    console.log("======================");

    const pairAddress = await uniswapFactory.getPair(BUILDING_TOKEN_ADDRESS, USDC_ADDRESS);
    console.log("Pair Address:", pairAddress);

    if (pairAddress === ethers.ZeroAddress) {
        console.log("✅ Pair does not exist yet - will be created");
    } else {
        console.log("⚠️  Pair already exists - will add to existing liquidity");

        // Get existing pair info
        const pair = await ethers.getContractAt("ERC20Mock", pairAddress);
        const totalSupply = await pair.totalSupply();
        console.log("Existing LP Token Supply:", ethers.formatEther(totalSupply));
    }

    // Check balances
    console.log("\n💰 Checking Balances");
    console.log("===================");

    const buildingTokenBalance = await buildingToken.balanceOf(signer.address);
    const usdcBalance = await usdc.balanceOf(signer.address);

    console.log("Building Token Balance:", ethers.formatEther(buildingTokenBalance));
    console.log("USDC Balance:", ethers.formatUnits(usdcBalance, 6));

    // Check if we have enough tokens
    if (buildingTokenBalance < BUILDING_TOKEN_AMOUNT) {
        console.log("❌ Insufficient building token balance");
        console.log(`Required: ${ethers.formatEther(BUILDING_TOKEN_AMOUNT)}`);
        console.log(`Available: ${ethers.formatEther(buildingTokenBalance)}`);
        return;
    }

    if (usdcBalance < USDC_AMOUNT) {
        console.log("❌ Insufficient USDC balance");
        console.log(`Required: ${ethers.formatUnits(USDC_AMOUNT, 6)}`);
        console.log(`Available: ${ethers.formatUnits(usdcBalance, 6)}`);
        return;
    }

    console.log("✅ Sufficient balances");

    // Check allowances
    console.log("\n🔐 Checking Allowances");
    console.log("=====================");

    const buildingTokenAllowance = await buildingToken.allowance(signer.address, UNISWAP_ROUTER_ADDRESS);
    const usdcAllowance = await usdc.allowance(signer.address, UNISWAP_ROUTER_ADDRESS);

    console.log("Building Token Allowance:", ethers.formatEther(buildingTokenAllowance));
    console.log("USDC Allowance:", ethers.formatUnits(usdcAllowance, 6));

    // Approve tokens if needed
    if (buildingTokenAllowance < BUILDING_TOKEN_AMOUNT) {
        console.log("🔓 Approving building token...");
        const tx1 = await buildingToken.approve(UNISWAP_ROUTER_ADDRESS, BUILDING_TOKEN_AMOUNT);
        await tx1.wait();
        console.log("✅ Building token approved");
    }

    if (usdcAllowance < USDC_AMOUNT) {
        console.log("🔓 Approving USDC...");
        const tx2 = await usdc.approve(UNISWAP_ROUTER_ADDRESS, USDC_AMOUNT);
        await tx2.wait();
        console.log("✅ USDC approved");
    }

    // Calculate minimum amounts with slippage
    console.log("\n📊 Calculating Minimum Amounts");
    console.log("=============================");

    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now

    // For new pairs, we need to calculate expected amounts
    let minBuildingTokenAmount: bigint;
    let minUsdcAmount: bigint;

    if (pairAddress === ethers.ZeroAddress) {
        // New pair - use the full amounts with slippage
        minBuildingTokenAmount = (BUILDING_TOKEN_AMOUNT * BigInt(10000 - SLIPPAGE_TOLERANCE)) / BigInt(10000);
        minUsdcAmount = (USDC_AMOUNT * BigInt(10000 - SLIPPAGE_TOLERANCE)) / BigInt(10000);
    } else {
        // Existing pair - get current reserves to calculate optimal amounts
        const pair = await ethers.getContractAt("IUniswapV2Pair", pairAddress);
        const reserves = await pair.getReserves();

        // Determine which token is token0 and token1
        const token0 = await pair.token0();
        const token1 = await pair.token1();

        let reserve0: bigint, reserve1: bigint;
        if (token0.toLowerCase() === BUILDING_TOKEN_ADDRESS.toLowerCase()) {
            reserve0 = reserves[0];
            reserve1 = reserves[1];
        } else {
            reserve0 = reserves[1];
            reserve1 = reserves[0];
        }

        // Calculate optimal amounts for existing pair
        const optimalAmounts = await uniswapRouter.quote(BUILDING_TOKEN_AMOUNT, reserve0, reserve1);

        minBuildingTokenAmount = (BUILDING_TOKEN_AMOUNT * BigInt(10000 - SLIPPAGE_TOLERANCE)) / BigInt(10000);
        minUsdcAmount = (optimalAmounts * BigInt(10000 - SLIPPAGE_TOLERANCE)) / BigInt(10000);
    }

    console.log("Min Building Token Amount:", ethers.formatEther(minBuildingTokenAmount));
    console.log("Min USDC Amount:", ethers.formatUnits(minUsdcAmount, 6));
    console.log("Deadline:", deadline);

    // Add liquidity
    console.log("\n💧 Adding Liquidity");
    console.log("==================");

    try {
        const tx = await uniswapRouter.addLiquidity(
            BUILDING_TOKEN_ADDRESS,
            USDC_ADDRESS,
            BUILDING_TOKEN_AMOUNT,
            USDC_AMOUNT,
            minBuildingTokenAmount,
            minUsdcAmount,
            signer.address,
            deadline,
        );

        console.log("✅ Transaction sent:", tx.hash);

        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Parse events
        console.log("\n📋 Transaction Events");
        console.log("====================");

        // Look for liquidity added events
        const liquidityAddedEvents = receipt.logs.filter((log) => {
            try {
                const parsed = uniswapRouter.interface.parseLog(log);
                return parsed.name === "LiquidityAdded";
            } catch {
                return false;
            }
        });

        if (liquidityAddedEvents.length > 0) {
            console.log("💧 Liquidity Added Events:");
            liquidityAddedEvents.forEach((event, index) => {
                const parsed = uniswapRouter.interface.parseLog(event);
                console.log(`  Event ${index + 1}:`);
                console.log(`    Token A: ${parsed.args.tokenA}`);
                console.log(`    Token B: ${parsed.args.tokenB}`);
                console.log(`    Amount A: ${ethers.formatEther(parsed.args.amountA)}`);
                console.log(`    Amount B: ${ethers.formatUnits(parsed.args.amountB, 6)}`);
                console.log(`    LP Tokens: ${ethers.formatEther(parsed.args.liquidity)}`);
            });
        }

        // Get final pair info
        const finalPairAddress = await uniswapFactory.getPair(BUILDING_TOKEN_ADDRESS, USDC_ADDRESS);
        console.log("\n🎯 Final Pair Information");
        console.log("========================");
        console.log("Pair Address:", finalPairAddress);

        if (finalPairAddress !== ethers.ZeroAddress) {
            const pair = await ethers.getContractAt("ERC20Mock", finalPairAddress);
            const totalSupply = await pair.totalSupply();
            const lpBalance = await pair.balanceOf(signer.address);

            console.log("Total LP Token Supply:", ethers.formatEther(totalSupply));
            console.log("Your LP Token Balance:", ethers.formatEther(lpBalance));
        }
    } catch (error) {
        console.log("❌ Failed to add liquidity:", error.message);

        if (error.message.includes("INSUFFICIENT_A_AMOUNT") || error.message.includes("INSUFFICIENT_B_AMOUNT")) {
            console.log("💡 Try increasing slippage tolerance or check token balances");
        } else if (error.message.includes("EXPIRED")) {
            console.log("💡 Try increasing the deadline");
        } else if (error.message.includes("TRANSFER_FAILED")) {
            console.log("💡 Check token approvals and balances");
        }
    }

    console.log("\n🏁 Liquidity Addition Complete");
    console.log("=============================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
