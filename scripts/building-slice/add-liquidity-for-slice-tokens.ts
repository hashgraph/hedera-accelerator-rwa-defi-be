import { ethers } from "hardhat";
import { promptAddress } from "../building/prompt-address";

/**
 * Script to add liquidity using existing asset tokens (not minting)
 * This script uses the owner's existing ERC3643 tokens to balance the pools
 *
 * Usage: npx hardhat run scripts/building-slice/add-liquidity-existing-tokens.ts --network testnet
 */
// Description: 💧 - Add Liquidity for Slice Tokens
const LIQUIDITY_CONFIG = {
    tokenAmount: ethers.parseUnits("10000", 18), // 10,000 tokens per pool
    usdcAmount: ethers.parseUnits("10000", 6), // 10,000 USDC per pool
};

async function main() {
    console.log("💧 Adding Liquidity with Existing Tokens");
    console.log("========================================");

    const [owner] = await ethers.getSigners();
    console.log(`Using account: ${owner.address}`);

    // Get slice address
    const sliceAddress = await promptAddress("Slice Address");
    const slice = await ethers.getContractAt("Slice", sliceAddress);

    const allocations = await slice.allocations();
    const uniswapRouter = await slice.uniswapV2Router();
    const baseToken = await slice.baseToken();

    console.log(`Slice: ${sliceAddress}`);
    console.log(`Router: ${uniswapRouter}`);
    console.log(`Base Token: ${baseToken}`);
    console.log(`Total Allocations: ${allocations.length}`);

    const router = await ethers.getContractAt("IUniswapV2Router02", uniswapRouter);
    const baseTokenContract = await ethers.getContractAt("ERC20Mock", baseToken);

    // Mint more base tokens if needed
    try {
        await baseTokenContract.mint(owner.address, ethers.parseUnits("50000", 6));
        console.log(`✅ Minted 50,000 base tokens to owner`);
    } catch (error) {
        console.log(`⚠️  Base token minting failed: ${error}`);
    }

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        console.log(`\n--- Adding Liquidity to Pool ${i + 1} ---`);
        console.log(`Asset: ${allocation.asset}`);

        try {
            // Get asset token contract
            const assetContract = await ethers.getContractAt(
                "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
                allocation.asset,
            );

            // Check current balances
            const ownerAssetBalance = await assetContract.balanceOf(owner.address);
            const ownerBaseBalance = await baseTokenContract.balanceOf(owner.address);

            console.log(`Owner Asset Balance: ${ethers.formatUnits(ownerAssetBalance, 18)}`);
            console.log(`Owner Base Balance: ${ethers.formatUnits(ownerBaseBalance, 6)}`);

            // Check if we have enough tokens
            if (ownerAssetBalance < LIQUIDITY_CONFIG.tokenAmount) {
                console.log(
                    `⚠️  Insufficient asset tokens (need ${ethers.formatUnits(
                        LIQUIDITY_CONFIG.tokenAmount,
                        18,
                    )}, have ${ethers.formatUnits(ownerAssetBalance, 18)})`,
                );
                console.log(`   Using available balance instead`);

                // Use available balance if it's reasonable
                if (ownerAssetBalance > ethers.parseUnits("1000", 18)) {
                    const adjustedTokenAmount = ownerAssetBalance;
                    const adjustedUsdcAmount =
                        (adjustedTokenAmount * LIQUIDITY_CONFIG.usdcAmount) / LIQUIDITY_CONFIG.tokenAmount;

                    console.log(`   Adjusted amounts:`);
                    console.log(`     Asset: ${ethers.formatUnits(adjustedTokenAmount, 18)}`);
                    console.log(`     USDC: ${ethers.formatUnits(adjustedUsdcAmount, 6)}`);

                    // Check if we have enough USDC
                    if (ownerBaseBalance < adjustedUsdcAmount) {
                        console.log(
                            `❌ Insufficient USDC (need ${ethers.formatUnits(
                                adjustedUsdcAmount,
                                6,
                            )}, have ${ethers.formatUnits(ownerBaseBalance, 6)})`,
                        );
                        continue;
                    }

                    // Approve tokens for router
                    console.log(`Approving tokens for router...`);
                    await assetContract.approve(uniswapRouter, adjustedTokenAmount);
                    await baseTokenContract.approve(uniswapRouter, adjustedUsdcAmount);
                    console.log(`✅ Tokens approved`);

                    // Add liquidity
                    console.log(`Adding liquidity...`);
                    const addLiquidityTx = await router.addLiquidity(
                        allocation.asset,
                        baseToken,
                        adjustedTokenAmount,
                        adjustedUsdcAmount,
                        (adjustedTokenAmount * 95n) / 100n, // 5% slippage
                        (adjustedUsdcAmount * 95n) / 100n, // 5% slippage
                        owner.address,
                        Math.floor(Date.now() / 1000) + 1800, // 30 minutes deadline
                        { gasLimit: 3000000 },
                    );

                    console.log(`✅ Liquidity added: ${addLiquidityTx.hash}`);
                } else {
                    console.log(`❌ Insufficient asset tokens for meaningful liquidity`);
                    continue;
                }
            } else {
                // We have enough tokens, proceed normally
                if (ownerBaseBalance < LIQUIDITY_CONFIG.usdcAmount) {
                    console.log(
                        `❌ Insufficient base tokens (need ${ethers.formatUnits(
                            LIQUIDITY_CONFIG.usdcAmount,
                            6,
                        )}, have ${ethers.formatUnits(ownerBaseBalance, 6)})`,
                    );
                    continue;
                }

                // Approve tokens for router
                console.log(`Approving tokens for router...`);
                await assetContract.approve(uniswapRouter, LIQUIDITY_CONFIG.tokenAmount);
                await baseTokenContract.approve(uniswapRouter, LIQUIDITY_CONFIG.usdcAmount);
                console.log(`✅ Tokens approved`);

                // Add liquidity
                console.log(`Adding liquidity...`);
                const addLiquidityTx = await router.addLiquidity(
                    allocation.asset,
                    baseToken,
                    LIQUIDITY_CONFIG.tokenAmount,
                    LIQUIDITY_CONFIG.usdcAmount,
                    (LIQUIDITY_CONFIG.tokenAmount * 95n) / 100n, // 5% slippage
                    (LIQUIDITY_CONFIG.usdcAmount * 95n) / 100n, // 5% slippage
                    owner.address,
                    Math.floor(Date.now() / 1000) + 1800, // 30 minutes deadline
                    { gasLimit: 3000000 },
                );

                console.log(`✅ Liquidity added: ${addLiquidityTx.hash}`);
            }

            // Check new pool reserves
            const factory = await ethers.getContractAt(
                "IUniswapV2Factory",
                "0x679261029c4e9B704bB54F6f4AF5241080191377",
            );
            const pairAddress = await factory.getPair(allocation.asset, baseToken);

            if (pairAddress !== "0x0000000000000000000000000000000000000000") {
                const pair = await ethers.getContractAt("IUniswapV2Pair", pairAddress);
                const reserves = await pair.getReserves();

                console.log(`New Pool Reserves:`);
                console.log(`  Asset: ${ethers.formatUnits(reserves[0], 18)}`);
                console.log(`  Base: ${ethers.formatUnits(reserves[1], 6)}`);
            }
        } catch (error: any) {
            console.error(`❌ Error adding liquidity to pool ${i + 1}: ${error.message}`);
        }
    }

    console.log(`\n✅ Liquidity addition complete!`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
