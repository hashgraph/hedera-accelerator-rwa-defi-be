import { ethers } from "hardhat";

async function main() {
  const Pair = await ethers.getContractFactory("UniswapV2Pair");
  const bytecode = Pair.bytecode;
  const initCodeHash = ethers.keccak256(bytecode);

  console.log("INIT_CODE_PAIR_HASH:", initCodeHash);
}

main();