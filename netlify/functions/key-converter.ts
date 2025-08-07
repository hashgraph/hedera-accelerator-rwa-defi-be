import { PrivateKey } from "@hashgraph/sdk";
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
    const body = JSON.parse(event.body || '{}');
    const { privateKey } = body;

    if (!privateKey) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Missing privateKey in request body'
        }),
      };
    }

    // Try to parse the private key
    let parsedKey;
    let keyFormat = 'unknown';
    
    try {
      // Try as ECDSA private key (standard format)
      parsedKey = PrivateKey.fromStringECDSA(privateKey);
      keyFormat = 'ECDSA';
    } catch (error1) {
      try {
        // Try as raw private key (if it's just the hex)
        if (privateKey.length === 64) {
          // This might be a raw private key, let's try to convert it
          const rawKey = privateKey;
          parsedKey = PrivateKey.fromStringECDSA(`302e020100300506032b657004220420${rawKey}`);
          keyFormat = 'RAW_HEX';
        } else {
          throw new Error('Unknown format');
        }
      } catch (error2) {
        return {
          statusCode: 400,
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: 'Invalid private key format',
            message: 'The private key could not be parsed in any known format',
            details: {
              originalLength: privateKey.length,
              error1: error1.message,
              error2: error2.message
            }
          }),
        };
      }
    }

    const publicKey = parsedKey.publicKey.toString();
    const accountId = parsedKey.publicKey.toAccountId(0, 0).toString();

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        keyFormat,
        publicKey,
        accountId,
        originalLength: privateKey.length,
        convertedLength: parsedKey.toString().length,
        message: 'Key converted successfully'
      }),
    };

  } catch (error) {
    console.error('Error in key-converter function:', error);
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
