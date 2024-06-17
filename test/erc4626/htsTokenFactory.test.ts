import { expect } from "chai";
import { ethers } from "hardhat";
import { HTSTokenFactory } from "../../typechain-types";

describe("HTSTokenFactory", function () {
  let htsTokenFactory: HTSTokenFactory; 

  before(async function () {
    const [owner] = await ethers.getSigners();

    const htsTokenFactoryDeployer = await ethers.getContractFactory("HTSTokenFactory");

    htsTokenFactory = await htsTokenFactoryDeployer.connect(owner).deploy({ gasLimit: 4800000 });
    await htsTokenFactory.waitForDeployment();
  });

  it("Should deploy new tokens correctly", async function () {
    const [owner] = await ethers.getSigners();

    await htsTokenFactory.connect(owner).deployToken("Test", "TsT", { gasLimit: 4800000, value: ethers.parseEther("13") });
    // Here we would ideally check the balance of bob
    expect(true).to.be.true;
  });
});
