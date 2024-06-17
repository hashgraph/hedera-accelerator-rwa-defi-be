import { ethers } from 'hardhat';
import { expect } from 'chai';
import Utils, { Operator } from '../../utils';
import { AccountId, PrivateKey, TokenId, ContractId, Client, ContractFunctionParameters, TransactionRecord, AccountCreateTransaction, Hbar, StatusError } from '@hashgraph/sdk';
import { AbiCoder } from 'ethers';
import { bytecode as ExchangeHTSbytecode } from '../../../data/abis/ExchangeHTS.json';
import elliptic from 'elliptic';

const depositToken = async (client: Client, operator: Operator, contract: ContractId, tokenId: TokenId | string, amount: number) => {
  client.setOperator(
    operator.accountId,
    operator.key
  );

  if (typeof tokenId != 'string') {
    tokenId = `0x${tokenId.toSolidityAddress()}`;
  }

  const functionName = "deposit";
  const params = new ContractFunctionParameters()
    .addAddress(tokenId)
    .addInt64(amount.toString());
  
  const { receipt, record } = await Utils.executeContract(client, operator, contract, functionName, params);
  
  if (receipt.status._code != 22) {
    throw new Error('Error depositing token status code' + receipt.status._code);
  }

  return {receipt, record};
}

const placeBuyOrder = async (client: Client, operator: Operator, contract: ContractId, price: number, volume: number) => {
  client.setOperator(
    operator.accountId,
    operator.key
  );
  const functionName = "placeBuyOrder";
  const params = new ContractFunctionParameters()
    .addInt64(price.toString())
    .addInt64(volume.toString());
  
    const { receipt, record }  = await Utils.executeContract(client, operator, contract, functionName, params, { gas : 600_000});
    
  if (receipt.status._code != 22) {
    throw new Error('Error depositing token status code' + receipt.status._code);
  }

  return { receipt, record };
}

const queryBalanceOfExchange = async (client: Client, contract: ContractId, userAddress: string, tokenAddress: string) => {
  const functionName = "balanceOf";
  const params = new ContractFunctionParameters()
      .addAddress(userAddress)
      .addAddress(tokenAddress);

  // Decode the result
  const result = await Utils.queryContract(client, contract, functionName, params);
  const balance = result.getInt64(0); // Adjust based on your function's return type
  return balance;
}

const placeSellOrder = async (client: Client, operator: Operator, contract: ContractId, price: number, volume: number) => {
  client.setOperator(
    operator.accountId,
    operator.key
  );
  const functionName = "placeSellOrder";
  const params = new ContractFunctionParameters()
    .addInt64(price.toString())
    .addInt64(volume.toString());
  
    const { receipt, record } = await Utils.executeContract(client, operator, contract, functionName, params, { gas : 600_000});
  
  if (receipt.status._code != 22) {
    throw new Error('Error depositing token status code' + receipt.status._code);
  }

  return { receipt, record };
}

const eventsEmited = (record: TransactionRecord, eventTopic: string) => {
  return record.contractFunctionResult?.logs.reduce((acc: Uint8Array[], log) => {
    for (const topic of log.topics) {
      const pTopic = `0x${Buffer.from(topic).toString('hex')}`;
      if (pTopic === eventTopic) {
        acc.push(log.data);
      }
    }
    return acc;
  }, [])
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function returnOneOf<T>(list: T[], except?: T) {
  if (list.length === 0) {
    throw new Error('returnOneOf: empty list');
  }

  let filteredList = except !== undefined ? list.filter(item => item !== except) : list;

  if (filteredList.length === 0) {
    return list[0]; // Handle case where all items are excluded
  }

  const randomIndex = Math.floor(Math.random() * filteredList.length);
  return filteredList[randomIndex];
}

const createECDSAKeyPair = () => {
  const EC = elliptic.ec;
  const ec = new EC('secp256k1');
  const keyPair = ec.genKeyPair();
  const privateKey = keyPair.getPrivate('hex');
  const publicKey = keyPair.getPublic('hex');

  return { privateKey, publicKey }
}

const createAccount = async (client: Client, operator: Operator): Promise<Operator> => {

  client.setOperator(operator.accountId, operator.key);

  const key = PrivateKey.fromStringECDSA(createECDSAKeyPair().privateKey);
  const accountCreate = new AccountCreateTransaction()
    .setKey(key)
    .setInitialBalance(new Hbar(3))
    .setTransactionValidDuration(180)
    .freezeWith(client);

  const tx = await accountCreate.execute(client);
  const receipt = await tx.getReceipt(client);

  console.log(`- account created with id ${receipt.accountId}`)
  
  return { accountId: receipt.accountId as AccountId, key, address: `0x${receipt.accountId?.toSolidityAddress()}` };
}

const retryThat = async (action: string, maxRetries: number, retryDelay: number, callback: Function) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    try{
      const result = await callback();

      return result;
    } catch (error) {
      //@ts-ignore
      console.error(`---- Error ${action}: ${error?.message} ----`);

      if (error instanceof StatusError && error.status.toString() === 'TRANSACTION_EXPIRED') {
          attempt++;
          console.warn(`Transaction expired. Retry attempt ${attempt}/${maxRetries}`);
          if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
      } else {
        throw error;
      }
    }
  }
}

async function deployExchangeFixture() {
  const client = Client.forTestnet().setMaxAttempts(10000)
  //Create your local client
  // const node = {"127.0.0.1:50211": new AccountId(3)};
  // const client = Client.forNetwork(node).setMirrorNetwork("127.0.0.1:5600")
    // .setMaxAttempts(100_000_000)
    // .setMaxBackoff(100_000_000);
      
  const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID as string);
  const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY as string);
  

  const operator = {
    accountId: operatorAccountId,
    key: operatorPrivateKey,
    address: '0x' + (operatorAccountId.toSolidityAddress().toLowerCase())
  }

  client.setOperator(
    operator.accountId,
    operator.key
  );

  // client.setOperator(AccountId.fromString("0.0.2"),PrivateKey.fromStringED25519("302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137"));

  const idTokenA = TokenId.fromSolidityAddress("0x000000000000000000000000000000000043cca1");
  const idTokenB = TokenId.fromSolidityAddress("0x000000000000000000000000000000000043cca2");
  const exchangeId = ContractId.fromString("0.0.4443300");
  // const idTokenA = await Utils.createFungibleToken(client, operator.accountId, operator.key, 'Test Token A', 'TOKEN_A');
  // const idTokenB = await Utils.createFungibleToken(client, operator.accountId, operator.key, 'Test Token B', 'TOKEN_B');

  const addressTokenA = '0x' + idTokenA.toSolidityAddress();
  const addressTokenB = '0x' + idTokenB.toSolidityAddress();

  // const exchangeId = await Utils.deployContract(
  //   client, 
  //   operator, 
  //   ExchangeHTSbytecode, 
  //   [addressTokenA, addressTokenB]
  // );

  // console.log(`deployed exchange at ${exchangeId} or ${exchangeId.toSolidityAddress()}`)

  const toTokenA = (_number: number) => {
    return _number * 10 ** 8;
  }

  const toTokenB = (_number: number) => {
    return _number * 10 ** 8;
  }

  const fromTokenA = (_number: number) => {
    return _number / 10 ** 8;
  }

  const fromTokenB = (_number: number) => {
    return _number / 10 ** 8;
  }

  const minting = [
    Utils.tokenMint(client, operator, idTokenA, toTokenA(100_000_000)),
    Utils.tokenMint(client, operator, idTokenB, toTokenB(100_000_000)),
  ];
  
  await Promise.all(minting);    

  return {
    client,
    operator,
    exchangeId,
    idTokenA,
    idTokenB,
    toTokenA,
    toTokenB,
    addressTokenA,
    addressTokenB,
    fromTokenA,
    fromTokenB
  }
}

describe('Load Test Exchange HTS', () => {
  describe('Exchange', () => {
    it('should load test', async () => {
      const { client, operator, exchangeId, idTokenB, idTokenA, toTokenB, toTokenA, addressTokenA, addressTokenB, fromTokenA, fromTokenB } = await deployExchangeFixture();

      function hasTradeEvent (record: TransactionRecord) {
        const tradeEvent = eventsEmited(record, ethers.id("Trade(int64,int64,address,address)")) as Uint8Array [];          
        if (tradeEvent.length){
          for( const trade of tradeEvent) {
            const parsedLogTrade = AbiCoder.defaultAbiCoder().decode(
              ["uint256", "uint256", "address"],
              trade
            );
            console.log(`-- Trade happend with ${parsedLogTrade.toString()}`);
          }
        }

        return tradeEvent.length;
      }

      const list = new Array(1300).fill(0);
      const userListSell = (await Promise.allSettled(list.slice(0, list.length / 2).map(async (_, index) => {
        const price = toTokenB(getRandomInt(1000, 1020))
        const amount = toTokenA(getRandomInt(1, 5));

        return retryThat('Creating Sell User', 5, 200, async () => {
          const newAccount = await createAccount(client, operator);
          await Utils.associateTokenToAccount(client, idTokenA, newAccount);
          await Utils.transferToken(client, idTokenA, operator, newAccount.accountId, amount);
          await Utils.approveToken(client, idTokenA, newAccount, exchangeId, (amount));
          await depositToken(client, newAccount, exchangeId, idTokenA, amount);
          return { account: newAccount, price: price, amount: amount }
        });

      })))
      .filter(p => p.status === 'fulfilled')
      // @ts-ignore
      .map((p) => p.value);

      const userListBuy = (await Promise.allSettled(list.slice(list.length / 2).map(async (_, index) => {
        const price = getRandomInt(1000, 1020);
        const amount = getRandomInt(1, 5);

        return retryThat('Creating Buy User', 5, 200, async () => {
          const newAccount = await createAccount(client, operator);
          await Utils.associateTokenToAccount(client, idTokenB, newAccount);
          await Utils.transferToken(client, idTokenB, operator, newAccount.accountId, toTokenB(price * amount));
          await Utils.approveToken(client, idTokenB, newAccount, exchangeId, toTokenB(price * amount));
          await depositToken(client, newAccount, exchangeId, idTokenB, toTokenB(price * amount));
          
          return { account: newAccount, price: toTokenB(price), amount: toTokenA(amount) }        
        });
        
      })))
      .filter(p => p.status === 'fulfilled')
      // @ts-ignore
      .map((p) => p.value);

      const buyOrders = userListBuy.map(async (trader, index) => {
        await new Promise((res) => { setTimeout(() => {res(true)}, 200 * index)});
        const { record: recordBuy} = await placeBuyOrder(client, trader.account, exchangeId, trader.price, trader.amount);
        hasTradeEvent(recordBuy);
        return trader;
      });

      const sellOrders = userListSell.map(async (trader, index) => {
        await new Promise((res) => { setTimeout(() => {res(true)}, 200 * (index + 1))});
        const { record: recordSell } = await placeSellOrder(client, trader.account, exchangeId, trader.price, trader.amount);
        hasTradeEvent(recordSell);
        return trader;
      })

      try {  
        const results = await Promise.allSettled([...buyOrders, ...sellOrders]);
        const rejected = results.filter(r => r.status === 'rejected');
        const fulfilled = results.filter(r => r.status === 'fulfilled');


        console.log({
          status: 'rejected',
          len : rejected.length,
          // @ts-ignore
          ids: rejected.map(rej => rej?.reason?.transactionId)
        })

        console.log({
          fulfilled: {
            len: fulfilled.length,
          }
        });

      } catch (error) {
        console.error("Error placing orders");
        console.error(error);
        expect.fail('Error placing orders');
      }

    });
  });
});

