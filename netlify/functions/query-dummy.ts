import {
  Client,
  ContractCallQuery,
  ContractFunctionParameters,
  PrivateKey,
  AccountId,
  ContractId,
} from "@hashgraph/sdk";
import { Handler } from '@netlify/functions'

export const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const accountId = process.env.ACCOUNT_ID;
    const privateKey = process.env.PRIVATE_KEY;

    if (!accountId || !privateKey) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Missing environment variables',
          message: 'ACCOUNT_ID and PRIVATE_KEY must be set'
        }),
      };
    }

    const dummyContractAddress = "0x9A5402BFCeD5b0A73De3277f421B34b6267D6Cb9";

    // Create client
    const operatorKey = PrivateKey.fromStringECDSA(privateKey);
    const operatorId = AccountId.fromString(accountId);
    const client = Client.forPreviewnet().setOperator(operatorId, operatorKey);

    // Create contract ID from address
    const contractId = ContractId.fromEvmAddress(0, 0, dummyContractAddress);

    // Query the getCount function
    const query = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100000)
      .setFunction("getCount", new ContractFunctionParameters());

    console.log("Querying Dummy contract getCount()...");
    const response = await query.execute(client);
    const count = response.getUint256(0);

    console.log("Current count:", count.toString());

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        count: count.toString(),
        contractAddress: dummyContractAddress,
        timestamp: new Date().toISOString()
      }),
    };

  } catch (error) {
    console.error('Error querying Dummy contract:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}; 
