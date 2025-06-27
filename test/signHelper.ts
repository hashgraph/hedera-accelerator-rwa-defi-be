import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Signature, TypedDataDomain } from "ethers";

export class SignHelper {
  async SignPermitTypedData(signer:HardhatEthersSigner, spender:string, tokenAddress: string, value: bigint, deadline: number): Promise<Signature> {
    const token = await ethers.getContractAt('ERC20Permit', tokenAddress);
    const nonce = await token.nonces(signer.address);
    const domain: TypedDataDomain = {
      name: await token.name(),
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await token.getAddress()
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

    const message = {
      owner: signer.address,
      spender,
      value,
      nonce,
      deadline
    };

    const signature = await signer.signTypedData(domain, types, message);
    return ethers.Signature.from(signature);
  }
}

