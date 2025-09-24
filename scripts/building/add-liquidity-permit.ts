import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TypedDataDomain } from "ethers";
import { promptBuilding } from "./prompt-building";
import { uniswapRouterAddress, usdcAddress } from "../../constants";

const UniswapV2Router02ABI = [
    {
        inputs: [
            {
                components: [
                    {
                        internalType: "address",
                        name: "tokenA",
                        type: "address",
                    },
                    {
                        internalType: "address",
                        name: "tokenB",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "amountADesired",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "amountBDesired",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "amountAMin",
                        type: "uint256",
                    },
                    {
                        internalType: "uint256",
                        name: "amountBMin",
                        type: "uint256",
                    },
                    {
                        internalType: "address",
                        name: "to",
                        type: "address",
                    },
                    {
                        internalType: "uint256",
                        name: "deadline",
                        type: "uint256",
                    },
                    {
                        internalType: "uint8[]",
                        name: "v",
                        type: "uint8[]",
                    },
                    {
                        internalType: "bytes32[]",
                        name: "r",
                        type: "bytes32[]",
                    },
                    {
                        internalType: "bytes32[]",
                        name: "s",
                        type: "bytes32[]",
                    },
                ],
                internalType: "struct UniswapV2Router02.AddLiquidityWithPermitParams",
                name: "params",
                type: "tuple",
            },
        ],
        name: "addLiquidityWithPermit",
        outputs: [
            {
                internalType: "uint256",
                name: "amountA",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "amountB",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "liquidity",
                type: "uint256",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
];

const ERC20PermitABI = [
    {
        inputs: [],
        name: "DOMAIN_SEPARATOR",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "name",
        outputs: [
            {
                internalType: "string",
                name: "",
                type: "string",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "PERMIT_TYPEHASH",
        outputs: [
            {
                internalType: "bytes32",
                name: "",
                type: "bytes32",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address",
            },
        ],
        name: "nonces",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];

// Description: 🪙 - Add Liquidity with permit
async function main() {
    const [owner] = await ethers.getSigners();

    const buildingDetails = await promptBuilding();
    const buildingTokenAddress = buildingDetails.erc3643Token;

    const tokenAddress = buildingTokenAddress; // ATS deployed ERC3643 Token
    const spender = uniswapRouterAddress; // spender is the address that will receive the tokens, in this case the uniswap router

    const uniswapRouter = await ethers.getContractAt(UniswapV2Router02ABI, uniswapRouterAddress);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    const amountADesired = ethers.parseUnits("1", 18);
    const amountBDesired = ethers.parseUnits("1", 6);

    // mint tokens to owner if necessary (used in testing)
    // const token = await ethers.getContractAt("ERC20Mock", tokenAddress);
    const usdc = await ethers.getContractAt("ERC20Mock", usdcAddress);
    // await token.mint(owner.address, amountADesired);
    await usdc.mint(owner.address, amountBDesired);

    const signatureToken = await getPermitSignatureAts(tokenAddress, owner, spender, amountADesired, deadline);
    const signatureUsdc = await getPermitSignature(usdcAddress, owner, spender, amountBDesired, deadline);

    const params = {
        tokenA: tokenAddress,
        tokenB: usdcAddress,
        amountADesired: amountADesired,
        amountBDesired: amountBDesired,
        amountAMin: 0n, // set minimun to zero for testing
        amountBMin: 0n, // set minimun to zero for testing
        to: owner.address,
        deadline: deadline,
        v: [signatureToken.v, signatureUsdc.v],
        r: [signatureToken.r, signatureUsdc.r],
        s: [signatureToken.s, signatureUsdc.s],
    };

    const tx = await uniswapRouter.addLiquidityWithPermit(params, { gasLimit: 15_000_000 });
    await tx.wait();

    console.log("tx", tx.hash);
}

async function getPermitSignatureAts(
    tokenAddress: string,
    owner: HardhatEthersSigner,
    spender: string,
    value: bigint,
    deadline: number,
) {
    const token = await ethers.getContractAt(ERC20PermitABI, tokenAddress);
    const nonce = await token.nonces(owner.address);

    const domain: TypedDataDomain = {
        name: "ERC20Permit",
        version: "1.0.0",
        chainId: (await ethers.provider.getNetwork()).chainId,
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
        owner: owner.address,
        spender,
        value,
        nonce,
        deadline,
    };

    const signature = await owner.signTypedData(domain, types, message);
    return ethers.Signature.from(signature);
}

async function getPermitSignature(
    tokenAddress: string,
    owner: HardhatEthersSigner,
    spender: string,
    value: bigint,
    deadline: number,
) {
    const token = await ethers.getContractAt(ERC20PermitABI, tokenAddress);
    const nonce = await token.nonces(owner.address);

    const domain: TypedDataDomain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
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
        owner: owner.address,
        spender,
        value,
        nonce,
        deadline,
    };

    const signature = await owner.signTypedData(domain, types, message);
    return ethers.Signature.from(signature);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
