import {
  Client,
  ContractExecuteTransaction,
  PrivateKey,
  AccountId,
  ContractId,
} from "@hashgraph/sdk";
import { Handler } from '@netlify/functions'

// Netlify Function handler
export const handler: Handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    // Validate environment variables
    const accountId = process.env.ACCOUNT_ID;
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!accountId || !privateKey || !contractAddress) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Missing environment variables',
          message: 'ACCOUNT_ID, PRIVATE_KEY, and CONTRACT_ADDRESS must be set',
          missing: {
            accountId: !accountId,
            privateKey: !privateKey,
            contractAddress: !contractAddress
          }
        }),
      };
    }

    const result = await executeKeeperTransaction();

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        done: true,
        transactionHash: result.transactionHash,
        status: result.status
      }),
    };

  } catch (error) {
    console.error('Error in keeper function:', error);
    return {
      statusCode: 500,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        done: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

async function executeKeeperTransaction() {
  const accountId = process.env.ACCOUNT_ID;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!accountId || !privateKey || !contractAddress) {
    throw new Error('Missing required environment variables');
  }

  console.log('Using account ID:', accountId);
  console.log('Contract address:', contractAddress);
  console.log('Private key length:', privateKey.length);

  const operatorKey = PrivateKey.fromStringECDSA(privateKey);
  const account = operatorKey.publicKey.toAccountId(0, 0); // shard 0, realm 0

  console.log('Account:', account.toString());
  const operatorId = AccountId.fromString(account.toString());
  console.log('operatorId:', operatorId.toString());
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);
  
  // console.log('Created operator ID:', operatorId.toString());
  // console.log('Created contract ID:', contractId.toString());

  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  const contractTx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("executeTasks")
    .setGas(100_000);

  console.log('Executing transaction...');
  const execution = await contractTx.execute(client);
  const receipt = await execution.getReceipt(client);
  
  console.log("- transaction executed:", receipt.status.toString());
  console.log("- transaction hash:", execution.transactionHash.toString());
  
  return {
    transactionHash: execution.transactionHash.toString(),
    status: receipt.status.toString()
  };
}
