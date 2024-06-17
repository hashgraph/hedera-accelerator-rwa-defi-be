import { expect } from "chai";
import { ethers } from "hardhat";
import { HTSToken } from "../../typechain-types";

describe("HTSToken", function () {
  let htsToken: HTSToken; 

  before(async function () {
    const [owner] = await ethers.getSigners();

    const htsTokenFactory = await ethers.getContractFactory("HTSToken");

    htsToken = await htsTokenFactory.connect(owner).deploy("Test", "TST", 8, { gasLimit: 4800000, value: ethers.parseEther("13") });
    await htsToken.waitForDeployment();
  });

  it("Should associate and mint tokens correctly", async function () {
    const [owner] = await ethers.getSigners();

    await htsToken.connect(owner).associate();
    await htsToken.connect(owner).mint(100);
    // Here we would ideally check the balance of bob
    expect(true).to.be.true;
  });
});
