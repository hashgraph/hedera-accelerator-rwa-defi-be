import {
  Client,
  ContractExecuteTransaction,
  PrivateKey,
  AccountId,
  ContractId,
  AccountBalanceQuery,
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
  const operatorId = AccountId.fromString(accountId);
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);
  
  console.log('Created operator ID:', operatorId.toString());
  console.log('Created contract ID:', contractId.toString());
  console.log('Public key:', operatorKey.publicKey.toString());

  const client = Client.forPreviewnet().setOperator(operatorId, operatorKey);

  const contractTx = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setFunction("executeTasks")
    .setGas(100_000)
    .freezeWith(client);

  console.log('Executing transaction...');
  const signedTx = await contractTx.sign(operatorKey);
  const execution = await signedTx.execute(client);
  const receipt = await execution.getReceipt(client);
  
  console.log("- transaction executed:", receipt.status.toString());
  console.log("- transaction hash:", execution.transactionHash.toString());
  
  return {
    transactionHash: Buffer.from(execution.transactionHash).toString('hex'),
    status: receipt.status.toString()
  };
}
