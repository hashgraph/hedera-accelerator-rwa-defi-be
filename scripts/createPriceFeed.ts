import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { Client, AccountId, PrivateKey, ContractCallQuery, ContractFunctionParameters } from "@hashgraph/sdk";
import { Contract } from "ethers";
import abi from "@pythnetwork/pyth-sdk-solidity/abis/MockPyth.json";

dotenv.config();

const mockPyth = "0x330C40b17607572cf113973b8748fD1aEd742943";

// async function createPriceFeedData(
//     id: any,
//     price: number,
//     conf: number,
//     expo: number,
//     emaPrice: number,
//     emaConf: number,
//     publishTime: number,
//     prevPublishTime: number,
//     client: Client
// ): Promise<string | null> {

//     const pyth = new ethers.Contract(mockPyth, abi, ethers.getDefaultProvider());

//     const encodedParams = ethers pyth.interface.encodeFunctionData(
//         "createPriceFeedUpdateData",
//         [id, price, conf, expo, emaPrice, emaConf, publishTime, prevPublishTime]
//     );

//     console.log("work");

//     // Call the contract on Hedera network
//     const contractCall = await new ContractCallQuery()
//         .setContractId(mockPyth)
//         .setFunctionParameters(Uint8Array.from(Buffer.from(encodedParams, 'hex')))
//         .setGas(100000) // Set appropriate gas limit
//         .execute(client);

//     console.log("work");

//     // Decode response from Hedera
//     const response = ethers.AbiCoder.defaultAbiCoder().decode(["bytes"], contractCall.bytes);

//     console.log("work");

// const priceFeedData = await pyth.createPriceFeedUpdateData(
//     id,
//     price,
//     conf,
//     expo,
//     emaPrice,
//     emaConf,
//     publishTime,
//     prevPublishTime
// );


//     // await pyth.updatePriceFeeds(priceFeedData);

//     // Return the encoded price feed data
//     return response.toString();
// }

async function main() {
    const [deployer] = await ethers.getSigners();
    let client = Client.forTestnet();

    const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
    const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

    client.setOperator(
        operatorAccountId,
        operatorPrKey
    );

    const types = [
        "bytes32",                   // id
        "int64",                     // price.price
        "uint64",                    // price.conf
        "int32",                     // price.expo
        "uint64",                    // price.publishTime
        "int64",                     // emaPrice.price
        "uint64",                    // emaPrice.conf
        "int32",                     // emaPrice.expo
        "uint64",                    // emaPrice.publishTime
        "uint64"                     // prevPublishTime
    ];
    // const values = [
    //     "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",  // id
    //     1500000000,    // price.price
    //     100000000,     // price.conf
    //     -8,            // price.expo
    //     1633045600,    // price.publishTime
    //     1495000000,    // emaPrice.price
    //     95000000,      // emaPrice.conf
    //     -8,            // emaPrice.expo
    //     1633045600,    // emaPrice.publishTime
    //     1633041600     // prevPublishTime
    // ];

    const values = [
        "0x2222222222222222222222222222222222222222222222222222222222222222",  // id
        1500000,    // price.price
        2000,     // price.conf
        -5,            // price.expo
        1698675600,    // price.publishTime
        1480000,    // emaPrice.price
        1800,      // emaPrice.conf
        -8,            // emaPrice.expo
        1698675600,    // emaPrice.publishTime
        1698672000     // prevPublishTime
    ];
    const priceFeed = ethers.AbiCoder.defaultAbiCoder().encode(types, values);

    // Query the contract to check changes in state variable
    // const contractQueryTx1 = new ContractCallQuery()
    //     .setContractId("0.0.4999394")
    //     .setGas(100000)
    //     .setFunction(
    //         "queryPriceFeed",
    //         new ContractFunctionParameters()
    //             .addBytes32(
    //                 ethers.getBytes("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
    //             )
    //     );

    // const contractQuerySubmit1 = await contractQueryTx1.execute(client);

    // console.log(contractQuerySubmit1);

    const pyth = await ethers.getContractAt(abi, mockPyth);

    const ar = [priceFeed]
    const tx = await pyth.updatePriceFeeds(ar);

    console.log(tx.hash);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
