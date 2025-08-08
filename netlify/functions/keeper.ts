import {
  Client,
  ContractExecuteTransaction,
  PrivateKey,
  AccountId,
  ContractId,
  ContractCallQuery,
  ContractFunctionParameters,
} from "@hashgraph/sdk";
import { Handler } from '@netlify/functions'
import { AbiCoder } from "ethers";

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

    const result = await executeKeeperTransactions();

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        done: true,
        transactions: result.transactions,
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

async function executeKeeperTransactions() {
  const accountId = process.env.ACCOUNT_ID;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!accountId || !privateKey || !contractAddress) {
    throw new Error('Missing required environment variables');
  }

  const operatorKey = PrivateKey.fromStringECDSA(privateKey);
  const operatorId = AccountId.fromString(accountId);
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);
  const client = Client.forPreviewnet().setOperator(operatorId, operatorKey);

  const taskIds = await getTaskList();

  let successfulTransactions: string[] = [];
  let failedTransactions: string[] = [];

  try {    
    for (const taskId of taskIds) {

      console.log('taskId', taskId);
      console.log('taskIdb', Buffer.from(taskId, 'hex'));
      const contractTx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setFunction("executeTask", 
        new ContractFunctionParameters()
        .addBytes32(Buffer.from(taskId.slice(2), 'hex'))
        .addBytes(Buffer.from("", 'hex')))
      .setGas(100_000)
      .freezeWith(client);
        
      console.log('Executing transaction...');
      const signedTx = await contractTx.sign(operatorKey);
      const execution = await signedTx.execute(client);
      const receipt = await execution.getReceipt(client);
      
      console.log("- transaction executed:", receipt.status.toString());
      console.log("- transaction hash:", Buffer.from(execution.transactionHash).toString('hex'));

      successfulTransactions.push(Buffer.from(execution.transactionHash).toString('hex'));
    }
  } catch (error) {
    console.error('Error executing transaction:', error);
    failedTransactions.push(error?.toString() || 'Unknown error');
  }

  return {
    transactions: {
      successful: successfulTransactions,
      failed: failedTransactions
    },
    status: "success"
  }
}

async function getTaskList(): Promise<string[]> {
  const accountId = process.env.ACCOUNT_ID;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!accountId || !privateKey || !contractAddress) {
    throw new Error('Missing required environment variables');
  }

  const operatorKey = PrivateKey.fromStringECDSA(privateKey);
  const operatorId = AccountId.fromString(accountId);
  const client = Client.forPreviewnet().setOperator(operatorId, operatorKey);
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);

  const query = new ContractCallQuery()
    .setContractId(contractId)
    .setGas(300_000)
    .setFunction("getTaskList");

  const res = await query.execute(client);
  const raw = res.asBytes();

  const [taskIds] = AbiCoder.defaultAbiCoder().decode([
    "bytes32[]",
  ], raw) as [string[]];
  
  console.log({taskIds});
  return taskIds;
}
