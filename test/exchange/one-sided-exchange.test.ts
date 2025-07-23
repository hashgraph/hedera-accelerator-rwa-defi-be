import { expect } from "chai";
import { ethers } from "hardhat";
import { Block, Signature } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { OneSidedExchange } from "../../typechain-types";
import { ERC20Mock } from "../../typechain-types";

describe("OneSidedExchange", function() {
  let owner: HardhatEthersSigner;
  let user: HardhatEthersSigner;
  let ownerAddress: string;
  let userAddress: string;
  let tokenA: ERC20Mock;
  let tokenB: ERC20Mock;
  let exchange: OneSidedExchange;
  const initialSupply = ethers.parseEther("1000");

  beforeEach(async function() {
    [owner, user] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    userAddress = await user.getAddress();

    // Deploy a test ERC20Permit token
    tokenA = await ethers.deployContract("ERC20Mock", ["TokenA", "TKNA", 18]);
    await tokenA.waitForDeployment();

    tokenB = await ethers.deployContract("ERC20Mock", ["TokenB", "TKNB", 18]);
    await tokenB.waitForDeployment();

    // Mint tokens for testing
    await tokenA.connect(owner).mint(userAddress, initialSupply);
    await tokenA.connect(owner).mint(ownerAddress, initialSupply);
    await tokenB.connect(owner).mint(ownerAddress, initialSupply);

    // Deploy the exchange
    const Exchange = await ethers.getContractFactory("OneSidedExchange");
    exchange = await Exchange.connect(owner).deploy();
    await exchange.waitForDeployment();
  });

  it("should allow the owner to deposit and withdraw tokens", async function() {
    // Approve and deposit tokenB
    await tokenB.connect(owner).approve(await exchange.getAddress(), initialSupply);

    await expect(exchange.connect(owner).deposit(await tokenB.getAddress(), initialSupply))
      .to.emit(exchange, "Deposit")
      .withArgs(await tokenB.getAddress(), initialSupply);

    expect(await tokenB.balanceOf(await exchange.getAddress())).to.equal(initialSupply);

    // Withdraw
    await expect(exchange.connect(owner).withdraw(await tokenB.getAddress(), initialSupply))
      .to.emit(exchange, "Withdraw")
      .withArgs(await tokenB.getAddress(), initialSupply);

    expect(await tokenB.balanceOf(await exchange.getAddress())).to.equal(0);
  });

  it("should perform swaps at the configured prices", async function() {
    // Owner deposits liquidity of tokenB
    const liquidity = ethers.parseEther("50");
    await tokenB.connect(owner).approve(await exchange.getAddress(), liquidity);
    await exchange.connect(owner).deposit(await tokenB.getAddress(), liquidity);

    // // Configure prices: 1 tokenA => 2 tokenB
    // const block = await ethers.provider.getBlock("latest") as Block;
    // const interval = block.timestamp + 1000;

    const twoDaysAfter = new Date().getSeconds() + (((24 * 60) * 60) * 2);
    await exchange.connect(owner).setSellPrice(await tokenA.getAddress(), 2, twoDaysAfter);
    await exchange.connect(owner).setBuyPrice(await tokenB.getAddress(), 2, twoDaysAfter);

    // User approves tokenA
    const swapAmount = ethers.parseEther("10");
    await tokenA.connect(user).approve(await exchange.getAddress(), ethers.parseEther("20"));

    // Execute swap
    await expect(exchange.connect(user).swap(await tokenA.getAddress(), await tokenB.getAddress(), swapAmount))
      .to.emit(exchange, "SwapSuccess");

    // Verify user balances
    // tokenASellAmount = 10 * 2 = 20
    // tokenBBuyAmount = (20 * 2) / 2 = 20
    expect(await tokenA.balanceOf(userAddress)).to.equal(ethers.parseEther("980"));
    expect(await tokenB.balanceOf(userAddress)).to.equal(ethers.parseEther("20"));
  });

  it("should enforce per-token thresholds", async function() {
    // Owner deposits liquidity
    const liquidity = ethers.parseEther("100");
    await tokenB.connect(owner).approve(await exchange.getAddress(), liquidity);
    await exchange.connect(owner).deposit(await tokenB.getAddress(), liquidity);

    // Configure prices at 1:1
    const twoDaysAfter = new Date().getSeconds() + (((24 * 60) * 60) * 2);
    await exchange.connect(owner).setSellPrice(await tokenA.getAddress(), 1, twoDaysAfter);
    await exchange.connect(owner).setBuyPrice(await tokenB.getAddress(), 1, twoDaysAfter);

    // Set a max-sell threshold of 5 tokenA
    await exchange.connect(owner).setThreshold(await tokenA.getAddress(), 5, 1000, twoDaysAfter);

    // Mint and approve tokenA to user
    await tokenA.connect(owner).mint(userAddress, ethers.parseEther("10"));
    const swapAmount = ethers.parseEther("6");
    await tokenA.connect(user).approve(await exchange.getAddress(), liquidity);

    // await exchange.connect(user).swap(await tokenA.getAddress(), await tokenB.getAddress(), swapAmount);

    // Swap should exceed threshold and revert
    await expect(
      exchange.connect(user).swap(await tokenA.getAddress(), await tokenB.getAddress(), swapAmount)
    ).to.be.rejectedWith("InvalidAmount");
  });

  it("should allow deposit via ERC20Permit (depositWithSignature)", async function() {
    const amount = ethers.parseEther("10");
    const deadline = ethers.MaxUint256;

    // Build permit signature
    const nonce = await tokenA.nonces(ownerAddress);
    const name = await tokenA.name();
    const chainId = (await ethers.provider.getNetwork()).chainId;

    const domain = {
      name,
      version: "1",
      chainId,
      verifyingContract: await tokenA.getAddress()
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const value = {
      owner: ownerAddress,
      spender: await exchange.getAddress(),
      value: amount,
      nonce: nonce,
      deadline
    };

    const signature = await owner.signTypedData(domain, types, value);
    const { v, r, s } = Signature.from(signature);

    // Execute depositWithSignature
    await expect(
      exchange.connect(owner).depositWithSignature(await tokenA.getAddress(), amount, deadline, v, r, s)
    ).to.emit(exchange, "Deposit").withArgs(await tokenA.getAddress(), amount);

    expect(await tokenA.balanceOf(await exchange.getAddress())).to.equal(amount);
  });

  it("should allow swap via ERC20Permit (swapWithSignature)", async function() {
    // owner deposits tokenB liquidity
    const liquidity = ethers.parseEther("50");
    await tokenB.connect(owner).approve(await exchange.getAddress(), liquidity);
    await exchange.connect(owner).deposit(await tokenB.getAddress(), liquidity);

    // configure 1:1 pricing
    const twoDaysAfter = new Date().getSeconds() + (((24 * 60) * 60) * 2);
    await exchange.connect(owner).setSellPrice(await tokenA.getAddress(), 1, twoDaysAfter);
    await exchange.connect(owner).setBuyPrice(await tokenB.getAddress(), 1, twoDaysAfter);

    // amount to swap
    const swapAmount = ethers.parseEther("5");

    // build ERC20Permit signature for user
    const nonce = await (tokenA as any).nonces(userAddress);
    const name = await tokenA.name();
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const domain = {
      name,
      version: "1",
      chainId,
      verifyingContract: await tokenA.getAddress()
    };
    const types = {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };
    const deadline = ethers.MaxUint256;
    const value = {
      owner: userAddress,
      spender: await exchange.getAddress(),
      value: swapAmount,
      nonce: nonce,
      deadline
    };
    const signature = await user.signTypedData(domain, types, value);
    const { v, r, s } = Signature.from(signature);

    // execute swapWithSignature
    await expect(
      exchange.connect(user).swapWithSignature(
        await tokenA.getAddress(), await tokenB.getAddress(),
        swapAmount, deadline,
        v, r, s
      )
    )
      .to.emit(exchange, "SwapSuccess")
      .withArgs(userAddress, await tokenA.getAddress(), await tokenB.getAddress(), swapAmount, swapAmount);

    // check final balances
    expect(await tokenA.balanceOf(userAddress)).to.equal(ethers.parseEther("995"));
    expect(await tokenB.balanceOf(userAddress)).to.equal(swapAmount);
  });

  it("Should fail on zero address provided on setThreshold()", async () => {
    try {
        const tokenASellAmount = 16n;
        const tokenABuyAmount = 10n;
        // Set days threshold to 2 days.
        const twoDaysAfterInSeconds = new Date().getSeconds() + (((24 * 60) * 60) * 2);

        await exchange.setThreshold(
            "0x0000000000000000000000000000000000000000",
            tokenASellAmount,
            tokenABuyAmount,
            twoDaysAfterInSeconds,
        );
    } catch (err: any) {
        const parsedMessage = err.message?.split("InvalidAddress")[1];

        expect(parsedMessage).to.be.includes("No zero address is allowed");
    }
  });

it("Should fail on zero address provided on swap()", async () => {
  try {
      const tokenBAddress = await tokenB.getAddress();
      const tokenASwapAmount = 2n;

      await exchange.swap(
          "0x0000000000000000000000000000000000000000",
          tokenBAddress,
          tokenASwapAmount,
      );
  } catch (err: any) {
      const parsedMessage = err.message?.split("InvalidAddress")[1];

      expect(parsedMessage).to.be.includes("No zero address is allowed");
  }
});

it("Should fail on zero amount provided on setThreshold()", async () => {
  // Set days threshold to 2 days.
  const twoDaysAfterInSeconds = new Date().getSeconds() + (((24 * 60) * 60) * 2);

  try {
      await exchange.setThreshold(
          "0x0000000000000000000000000000000000004567",
          0n,
          0n,
          twoDaysAfterInSeconds
      );
  } catch (err: any) {
      const parsedMessage = err.message?.split("InvalidAmount")[1];

      expect(parsedMessage).to.be.includes("Zero amount is not allowed");
  }
});
});
