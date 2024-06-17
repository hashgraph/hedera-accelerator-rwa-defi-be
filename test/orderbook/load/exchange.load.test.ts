import { ethers } from 'hardhat';
import { expect } from 'chai';
import Utils, { Operator } from '../../utils';
import { AccountId, PrivateKey, TokenId, ContractId, Client, ContractFunctionParameters, TransactionRecord, AccountCreateTransaction, Hbar } from '@hashgraph/sdk';
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
    .setInitialBalance(new Hbar(1000))
    .freezeWith(client);

  const tx = await accountCreate.execute(client);
  const receipt = await tx.getReceipt(client);

  console.log(`- account created with id ${receipt.accountId}`)
  
  return { accountId: receipt.accountId as AccountId, key, address: `0x${receipt.accountId?.toSolidityAddress()}` };
}

async function deployExchangeFixture() {
  const node = {"127.0.0.1:50211": new AccountId(3)};
  const client = Client.forNetwork(node).setMirrorNetwork("127.0.0.1:5600").setMaxAttempts(100_000_000).setMaxBackoff(100_000_000);
      
  const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID as string);
  const operatorPrivateKey = PrivateKey.fromStringED25519(process.env.PRIVATE_KEY as string);
  
  const aliceAccountId = AccountId.fromString(process.env.ALICE_ACCOUNT_ID as string);
  const alicePrivateKey = PrivateKey.fromStringED25519(process.env.ALICE_KEY as string);
  
  const bobAccountId = AccountId.fromString(process.env.BOB_ACCOUNT_ID as string);
  const bobPrivateKey = PrivateKey.fromStringECDSA(process.env.BOB_KEY as string);
  
  const charlieAccountId = AccountId.fromString(process.env.CHARLIE_ACCOUNT_ID as string);
  const charliePrivateKey = PrivateKey.fromStringECDSA(process.env.CHARLIE_KEY as string);
  
  const davidAccountId = AccountId.fromString(process.env.DAVID_ACCOUNT_ID as string);
  const davidPrivateKey = PrivateKey.fromStringED25519(process.env.DAVID_KEY as string);

  const operator = {
    accountId: operatorAccountId,
    key: operatorPrivateKey,
    address: '0x' + (operatorAccountId.toSolidityAddress().toLowerCase())
  }

 
  // {
  //   accountId: aliceAccountId,
  //   key: alicePrivateKey,
  //   address: '0x' + (aliceAccountId.toSolidityAddress().toLowerCase())
  // }

  // const bob = {
  //   accountId: bobAccountId,
  //   key: bobPrivateKey,
  //   address: '0x' + (bobAccountId.toSolidityAddress().toLowerCase())
  // }

  // const charlie = {
  //   accountId: charlieAccountId,
  //   key: charliePrivateKey,
  //   address: '0x' + (charlieAccountId.toSolidityAddress().toLowerCase())
  // }

  // const david = {
  //   accountId: davidAccountId,
  //   key: davidPrivateKey,
  //   address: '0x' + (davidAccountId.toSolidityAddress().toLowerCase())
  // }

  // client.setOperator(
  //   operator.accountId,
  //   operator.key
  // );

  client.setOperator(AccountId.fromString("0.0.2"),PrivateKey.fromStringED25519("302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137"));

  const alice = await createAccount(client, operator) 
  const bob = await createAccount(client, operator) 
  const charlie = await createAccount(client, operator) 
  const david = await createAccount(client, operator) 

  // const idTokenA = TokenId.fromString('0.0.4421954');
  // const idTokenB = TokenId.fromString('0.0.4421955');
  // const exchangeId = ContractId.fromString("0.0.4422160");
  const idTokenA = await Utils.createFungibleToken(client, operator.accountId, operator.key, 'Test Token A', 'TOKEN_A');
  const idTokenB = await Utils.createFungibleToken(client, operator.accountId, operator.key, 'Test Token B', 'TOKEN_B');

  const addressTokenA = '0x' + idTokenA.toSolidityAddress();
  const addressTokenB = '0x' + idTokenB.toSolidityAddress();

  const exchangeId = await Utils.deployContract(
    client, 
    operator, 
    ExchangeHTSbytecode, 
    [addressTokenA, addressTokenB]
  );

  console.log(`deployed exchange at ${exchangeId} or ${exchangeId.toSolidityAddress()}`)

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
    Utils.tokenMint(client, operator, idTokenA, toTokenA(1_000_000 * 4)),
    Utils.tokenMint(client, operator, idTokenB, toTokenB(1_000_000 * 4)),
  ];
  
  await Promise.all(minting);    

  const associations = [
    // token A
    Utils.associateTokenToAccount(client, idTokenA, alice),
    Utils.associateTokenToAccount(client, idTokenA, bob),
    Utils.associateTokenToAccount(client, idTokenA, charlie),
    Utils.associateTokenToAccount(client, idTokenA, david),
    // token B
    Utils.associateTokenToAccount(client, idTokenB, alice),
    Utils.associateTokenToAccount(client, idTokenB, bob),
    Utils.associateTokenToAccount(client, idTokenB, charlie),
    Utils.associateTokenToAccount(client, idTokenB, david),
  ];

  await Promise.all(associations);    

  const transfers = [
    // token A
    Utils.transferToken(client, idTokenA, operator, alice.accountId, toTokenA(1_000_000)),
    Utils.transferToken(client, idTokenA, operator, bob.accountId, toTokenA(1_000_000)),
    Utils.transferToken(client, idTokenA, operator, charlie.accountId, toTokenA(1_000_000)),
    Utils.transferToken(client, idTokenA, operator, david.accountId, toTokenA(1_000_000)),
    // // token B
    Utils.transferToken(client, idTokenB, operator, alice.accountId, toTokenB(1_000_000)),
    Utils.transferToken(client, idTokenB, operator, bob.accountId, toTokenB(1_000_000)),
    Utils.transferToken(client, idTokenB, operator, charlie.accountId, toTokenB(1_000_000)),
    Utils.transferToken(client, idTokenB, operator, david.accountId, toTokenB(1_000_000)),
    // token A
    Utils.approveToken(client, idTokenA, alice, exchangeId, toTokenA(1_000_000)),
    Utils.approveToken(client, idTokenA, bob, exchangeId, toTokenA(1_000_000)),
    Utils.approveToken(client, idTokenA, charlie, exchangeId, toTokenA(1_000_000)),
    Utils.approveToken(client, idTokenA, david, exchangeId, toTokenA(1_000_000)),
    // token B
    Utils.approveToken(client, idTokenB, alice, exchangeId, toTokenB(1_000_000)),
    Utils.approveToken(client, idTokenB, bob, exchangeId, toTokenB(1_000_000)),
    Utils.approveToken(client, idTokenB, charlie, exchangeId, toTokenB(1_000_000)),
    Utils.approveToken(client, idTokenB, david, exchangeId, toTokenB(1_000_000)),
  ];

  await Promise.all(transfers);    

  return {
    client,
    operator,
    alice,
    bob,
    charlie,
    david,
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
      const { client, alice, bob, charlie, david, exchangeId, idTokenB, idTokenA, toTokenB, toTokenA, addressTokenA, addressTokenB, fromTokenA, fromTokenB } = await deployExchangeFixture();

      // deposits
      await Promise.all([
        depositToken(client, alice, exchangeId, idTokenA, toTokenA(1_000_000)),
        depositToken(client, bob, exchangeId, idTokenA, toTokenA(1_000_000)),
        depositToken(client, charlie, exchangeId, idTokenA, toTokenA(1_000_000)),
        depositToken(client, david, exchangeId, idTokenA, toTokenA(1_000_000)),

        depositToken(client, alice, exchangeId, idTokenB, toTokenB(1_000_000)),
        depositToken(client, bob, exchangeId, idTokenB, toTokenB(1_000_000)),
        depositToken(client, charlie, exchangeId, idTokenB, toTokenB(1_000_000)),
        depositToken(client, david, exchangeId, idTokenB, toTokenB(1_000_000)),
      ]);

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

      const list = new Array(100).fill(0);

      const buyOrders = list.map(async (order, index) => {
        await new Promise((res) => { setTimeout(() => {res(true)}, 300 * index)});
        const buyer = returnOneOf<Operator>([alice, bob, charlie, david]);
        const { record: recordBuy} = await placeBuyOrder(client, buyer, exchangeId, toTokenB(getRandomInt(1000, 1020)), toTokenA(getRandomInt(1, 5)));
        hasTradeEvent(recordBuy);
        return order;
      });

      const sellOrders = list.map(async (order, index) => {
        await new Promise((res) => { setTimeout(() => {res(true)}, 200 * (index + 1))});
        const seller = returnOneOf<Operator>([alice, bob, charlie, david]);
        const { record: recordSell } = await placeSellOrder(client, seller, exchangeId, toTokenB(getRandomInt(1000, 1020)), toTokenA(getRandomInt(1, 15)));
        hasTradeEvent(recordSell);
        return order;
      })

      try {  
        const results = await Promise.allSettled([...buyOrders, ...sellOrders]);
        const rejected = results.filter(r => r.status === 'rejected');
        const fulfilled = results.filter(r => r.status === 'fulfilled');


        console.log({
          status: 'rejected',
          len : rejected.length,
          // @ts-ignore
          ids: rejected.map(rej => rej.reason.transactionId.toString())
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



      const aliceTokenABalance = (await queryBalanceOfExchange(client, exchangeId, alice.address, addressTokenA)).toNumber();
      const aliceTokenBBalance = (await queryBalanceOfExchange(client, exchangeId, alice.address, addressTokenB)).toNumber();
      
      const bobTokenABalance = (await queryBalanceOfExchange(client, exchangeId, "0xed9a4895a19483001d7228354d714e7ea4523d4b", addressTokenA)).toNumber();
      const bobTokenBBalance = (await queryBalanceOfExchange(client, exchangeId, "0xed9a4895a19483001d7228354d714e7ea4523d4b", addressTokenB)).toNumber();
      
      const charlieTokenABalance = (await queryBalanceOfExchange(client, exchangeId, "0xb8c8d838121d5bf0a7b022737b34b13eb9fa5bea", addressTokenA)).toNumber();
      const charlieTokenBBalance = (await queryBalanceOfExchange(client, exchangeId, "0xb8c8d838121d5bf0a7b022737b34b13eb9fa5bea", addressTokenB)).toNumber();
      
      const davidTokenABalance = (await queryBalanceOfExchange(client, exchangeId, david.address, addressTokenA)).toNumber();
      const davidTokenBBalance = (await queryBalanceOfExchange(client, exchangeId, david.address, addressTokenB)).toNumber();


      console.log({
        aliceTokenABalance: fromTokenA(aliceTokenABalance),
        bobTokenABalance: fromTokenA(bobTokenABalance),
        charlieTokenABalance: fromTokenA(charlieTokenABalance),
        davidTokenABalance: fromTokenA(davidTokenABalance),
        aliceTokenBBalance: fromTokenB(aliceTokenBBalance),
        bobTokenBBalance: fromTokenB(bobTokenBBalance),
        charlieTokenBBalance: fromTokenB(charlieTokenBBalance),
        davidTokenBBalance: fromTokenB(davidTokenBBalance),
      })
      


    });
  });
});

