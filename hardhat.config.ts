import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-contract-sizer";
// import "@nomicfoundation/hardhat-foundry";

import * as dotenv from "dotenv";
require("solidity-coverage");

dotenv.config();

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY || ""; 
const PRIVATE_KEY2 = process.env.PRIVATE_KEY2 || "";
const PRIVATE_KEY3 = process.env.PRIVATE_KEY3 || "";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 100,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    mainnet: {
      chainId: 295, // hedera mainnet chainId
      url: RPC_URL,
      accounts: [PRIVATE_KEY, PRIVATE_KEY2, PRIVATE_KEY3],
    },
    testnet: {
      chainId: 296, // hedera testnet chainId
      url: RPC_URL,
      accounts: [PRIVATE_KEY, PRIVATE_KEY2, PRIVATE_KEY3],
      timeout: 200000000,
      allowUnlimitedContractSize: true,
    },
    previewnet: {
      chainId: 297, // hedera previewnet chainId
      url: RPC_URL,
      accounts: [PRIVATE_KEY, PRIVATE_KEY2, PRIVATE_KEY3],
    },
    hardhat: {
      blockGasLimit: 9999999999999,
      gas: 30000000,
      allowUnlimitedContractSize: true,
      // forking: {
      //   url: process.env.RPC_URL || "",
      // },
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
    coinmarketcap: COINMARKETCAP_API_KEY,
    token: 'HBAR'
  },
  mocha: {
    timeout: 100000000,
  },
};

export default config;
