import {
  Client,
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
    const contractAddress = process.env.CONTRACT_ADDRESS;

    // Check if environment variables are set
    const envStatus = {
      accountId: !!accountId,
      privateKey: !!privateKey,
      contractAddress: !!contractAddress,
      privateKeyLength: privateKey ? privateKey.length : 0
    };

    let validationResult = {
      envStatus,
      isValid: true,
      errors: [] as string[]
    };

    // Test account ID format
    if (accountId) {
      try {
        const operatorId = AccountId.fromString(accountId);
        console.log('Account ID is valid:', operatorId.toString());
      } catch (error) {
        validationResult.isValid = false;
        validationResult.errors.push(`Invalid ACCOUNT_ID format: ${error}`);
      }
    }

    // Test private key format
    if (privateKey) {
      try {
        const operatorKey = PrivateKey.fromStringECDSA(privateKey);
        console.log('Private key is valid, public key:', operatorKey.publicKey.toString());
      } catch (error) {
        validationResult.isValid = false;
        validationResult.errors.push(`Invalid PRIVATE_KEY format: ${error}`);
      }
    }

    // Test contract address format
    if (contractAddress) {
      try {
        const contractId = ContractId.fromEvmAddress(0, 0, contractAddress);
        console.log('Contract address is valid:', contractId.toString());
      } catch (error) {
        validationResult.isValid = false;
        validationResult.errors.push(`Invalid CONTRACT_ADDRESS format: ${error}`);
      }
    }

    // Test client creation
    if (accountId && privateKey) {
      try {
        const operatorId = AccountId.fromString(accountId);
        const operatorKey = PrivateKey.fromStringECDSA(privateKey);
        const client = Client.forTestnet().setOperator(operatorId, operatorKey);
        console.log('Client created successfully');
        validationResult.clientCreated = true;
      } catch (error) {
        validationResult.isValid = false;
        validationResult.errors.push(`Failed to create client: ${error}`);
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validationResult, null, 2),
    };

  } catch (error) {
    console.error('Error in test-config function:', error);
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
