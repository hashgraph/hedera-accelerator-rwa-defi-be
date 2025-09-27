import { ethers } from "hardhat";

// Description: 🔍 - Get the init code hash for the UniswapV2Pair contract
async function main() {
    const Pair = await ethers.getContractFactory("UniswapV2Pair");
    const bytecode = Pair.bytecode;
    const initCodeHash = ethers.keccak256(bytecode);

    console.log("INIT_CODE_PAIR_HASH:", initCodeHash);
}

main();
