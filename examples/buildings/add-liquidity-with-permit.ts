import { ethers } from "hardhat";
import { TypedDataDomain } from "ethers";
import { splitSignature } from "@ethersproject/bytes";
import Deployments from '../../data/deployments/chain-296.json';
import { usdcAddress, uniswapRouterAddress } from "../../constants";

// Function to sign a permit for an ERC20 token
// This function is used to sign the permit for the UniswapV2Router02's addLiquidityWithPermit function
// It uses the EIP-2612 standard for permits
// The function takes the token contract, owner address, spender address, value, and deadline as parameters
async function signPermit(
  token: any,
  owner: string,
  spender: string,
  value: bigint,
  deadline: number
) {
  const name = await token.name();
  const nonce = await token.nonces(owner);
  
  // version is the version of the permit function
  // it is usually "1" for the EIP-2612 standard
  // but it can be different for different tokens
  // here we assume the version is "1"
  // if the token has a different version, you should change it accordingly
  const version = "1"; 

  const network = await ethers.provider.getNetwork();

  const domain: TypedDataDomain = {
    name,
    version,
    chainId: network.chainId,
    verifyingContract: await token.getAddress(),
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    owner,
    spender,
    value,
    nonce,
    deadline,
  };

  const signer = await ethers.getSigner(owner);
  const signature = await signer.signTypedData(domain, types, message);

  return splitSignature(signature);
}

async function main() {
  const [signer] = await ethers.getSigners();

  // Get the UniswapV2Router02 contract instance
  // using the uniswapRouterAddress from constants
  // or from the deployment data
  // this is an updated router with the addLiquidityWithPermit function
  const router = await ethers.getContractAt("UniswapV2Router02", uniswapRouterAddress);
  
  // Get the BuildingFactory contract instance
  // using the address from the deployment data
  const buildingFactory = await ethers.getContractAt('BuildingFactory', Deployments.factories.BuildingFactory);

  // Get the building details
  // assuming the building address is known
  // replace "0x1B7cAF9da635dD9D339..." with the actual building address
  // this address should be the one created in create-building.ts
  // or the one you want to add liquidity to
  const building = await buildingFactory.getBuildingDetails("0x1B7cAF9da635dD9D339...");

  // Get the token contracts for the building's erc3643Token and USDC
  // assuming the building's erc3643Token is an ERC20Permit token
  // and USDC is also an ERC20Permit token
  const tokenA = await ethers.getContractAt('ERC20Mock', building.erc3643Token);
  const tokenB = await ethers.getContractAt('ERC20Mock', usdcAddress);

  // Set the desired amounts for both tokens
  // these are the amounts you want to add to the liquidity pool
  // you can adjust these values based on your requirements
  // here we set them to 1000 tokens for both tokens
  const amountADesired = ethers.parseUnits("1000", await tokenA.decimals());
  const amountBDesired = ethers.parseUnits("1000", await tokenB.decimals());

  // Set the minimum amounts for both tokens
  // these are the minimum amounts you want to add to the liquidity pool
  // you can set them to a lower value if you want to be more flexible
  // or to a higher value if you want to be more strict
  // here we set them to 90% of the desired amounts
  // this means that if the actual amounts are lower than these, the transaction will revert
  // this is to protect against slippage and ensure you get the desired amounts
  // you can adjust these values based on your requirements
  const amountAMin = ethers.parseUnits("900", await tokenA.decimals());
  const amountBMin = ethers.parseUnits("900", await tokenB.decimals());
  // Set the deadline for the permit
  // this is the time until which the permit is valid
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  // mint tokens to the signer address
  // assuming both tokens are ERC20Mock and have a mint function
  // this is just for testing purposes, in production you would not mint tokens like this
  // you would use the actual token contract deployed on the network
  // and the signer should already have tokens in their balance
  await tokenA.mint(signer.address, amountADesired);
  await tokenB.mint(signer.address, amountBDesired);

  // sign permits for both tokens
  // assuming both tokens implement the IERC20Permit interface
  const sigA = await signPermit(tokenA, signer.address, uniswapRouterAddress, amountADesired, deadline);
  const sigB = await signPermit(tokenB, signer.address, uniswapRouterAddress, amountBDesired, deadline);

  // Prepare permit parameters
  // Note: The UniswapV2Router02 contract expects the permit parameters in a specific format
  // and the function signature is addLiquidityWithPermit(permitParams)
  const permitParams = {
    tokenA: await tokenA.getAddress(),
    tokenB: await tokenB.getAddress(),
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    to: signer.address,
    deadline,
    v: [sigA.v, sigB.v],
    r: [sigA.r, sigB.r],
    s: [sigA.s, sigB.s],
  }

  // call addLiquidityWithPermit on the router
  // Note: The UniswapV2Router02 contract expects the permit parameters in a specific format
  // and the function signature is addLiquidityWithPermit(permitParams)
  const tx = await router.addLiquidityWithPermit(permitParams, );
  await tx.wait();

  console.log("Liquidity added.", tx.hash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
