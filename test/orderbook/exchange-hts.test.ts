import { ethers } from 'hardhat';
import { expect } from 'chai';
import Utils, { Operator } from '../utils';
import { AccountId, PrivateKey, TokenId, ContractId, Client, ContractFunctionParameters, TransactionRecord } from '@hashgraph/sdk';
import { AbiCoder } from 'ethers';
import { bytecode as ExchangeHTSbytecode } from '../../data/abis/ExchangeHTS.json';

const cancelOrder = async (client: Client, operator: Operator, contract: ContractId, orderId: number, isBuy: boolean) => {
  client.setOperator(
    operator.accountId,
    operator.key
  );

  const functionName = "cancelOrder";
  const params = new ContractFunctionParameters()
    .addUint256(orderId.toString())
    .addBool(isBuy)
  
  const { receipt, record } = await Utils.executeContract(client, operator, contract, functionName, params);
  
  if (receipt.status._code != 22) {
    throw new Error('Error depositing token status code' + receipt.status._code);
  }

  return {receipt, record};
}

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

const withdrawToken = async (client: Client, operator: Operator, contract: ContractId, tokenAddress:  string, amount: number) => {
  client.setOperator(
    operator.accountId,
    operator.key
  );
  const functionName = "withdraw";
  const params = new ContractFunctionParameters()
    .addAddress(tokenAddress)
    .addInt64(amount.toString());
  
    const { receipt, record } = await Utils.executeContract(client, operator, contract, functionName, params);
  
  if (receipt.status._code != 22) {
    throw new Error('Error withdrawing token status code' + receipt.status._code);
  }

  return { receipt, record };
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
  
    const { receipt, record }  = await Utils.executeContract(client, operator, contract, functionName, params);
    
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

const queryCurrentOrderId = async (client: Client, contract: ContractId) => {
  const functionName = "currentOrderId";
  const params = new ContractFunctionParameters();

  // Decode the result
  const result = await Utils.queryContract(client, contract, functionName, params);
  const balance = result.getUint256(0); // Adjust based on your function's return type
  return balance;
}

const queryBuyOrder = async (client: Client, contract: ContractId, orderId: number) => {
  const functionName = "buyOrders";
  const params = new ContractFunctionParameters()
    .addUint256(orderId);

  // Decode the result
  const result = await Utils.queryContract(client, contract, functionName, params);

  const id = result.getUint256(0);
  const price = result.getInt64(1);
  const volume = result.getInt64(2);
  const trader = `0x${result.getAddress(3)}`;
  const next = result.getInt64(4);

  return { id, price, volume, trader, next };
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
  
    const { receipt, record } = await Utils.executeContract(client, operator, contract, functionName, params);
  
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

async function deployExchangeFixture() {
  const client = Client.forTestnet();
      
  const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID as string);
  const operatorPrivateKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY as string);
  
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
    address: '0x' + operatorAccountId.toSolidityAddress(),
  }

  const alice = {
    accountId: aliceAccountId,
    key: alicePrivateKey,
    address: '0x' + aliceAccountId.toSolidityAddress(),
  }

  const bob = {
    accountId: bobAccountId,
    key: bobPrivateKey,
    address: '0x' + bobAccountId.toSolidityAddress()
  }

  const charlie = {
    accountId: charlieAccountId,
    key: charliePrivateKey,
    address: '0x' + charlieAccountId.toSolidityAddress()
  }

  const david = {
    accountId: davidAccountId,
    key: davidPrivateKey,
    address: '0x' + davidAccountId.toSolidityAddress()
  }

  client.setOperator(
    operator.accountId,
    operator.key
  );

  // const idTokenA = TokenId.fromString('0.0.4378383');
  // const idTokenB = TokenId.fromString('0.0.4378385');
  // const exchangeId = ContractId.fromString("0.0.4397364");
  const idTokenA = await Utils.createFungibleToken(client, operator.accountId, operator.key, 'Test Token A', 'TOKEN_A');
  const idTokenB = await Utils.createFungibleToken(client, operator.accountId, operator.key, 'Test Token B', 'TOKEN_B');
  const exchangeId = await Utils.deployContract(
    client, 
    operator, 
    ExchangeHTSbytecode, 
    ['0x' + idTokenA.toSolidityAddress(), '0x' + idTokenB.toSolidityAddress()]
  );

  console.log(`deployed exchange at ${exchangeId} or ${exchangeId.toSolidityAddress()}`)

  const toTokenA = (_number: number) => {
    return _number * 10 ** 8;
  }

  const toTokenB = (_number: number) => {
    return _number * 10 ** 8;
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
  }
}

describe('Exchange HTS', () => {
  describe('Exchange', () => {
    describe('.lastOrderId', () => {
      describe('when buy or sell order is placed', () => {
        it("should increment by 1", async function() {
          const { client, alice, exchangeId, idTokenB, toTokenA, toTokenB } = await deployExchangeFixture();
          await depositToken(client, alice, exchangeId, idTokenB, toTokenB(400));
          const currentId = await queryCurrentOrderId(client, exchangeId);
          
          const orders = [ 
            placeBuyOrder(client, alice, exchangeId, toTokenB(100), toTokenA(1)),
            placeBuyOrder(client, alice, exchangeId, toTokenB(100), toTokenA(1)),
            placeBuyOrder(client, alice, exchangeId, toTokenB(100), toTokenA(1)),
            placeBuyOrder(client, alice, exchangeId, toTokenB(100), toTokenA(1)),
          ]
          
          await Promise.all(orders);

          expect(await queryCurrentOrderId(client, exchangeId)).to.equal(currentId.plus(4));
        });
      });
    });

    describe('.placeBuyOrder', () => {
      describe('when there is not matching sell order', () => {
        it('should place buy order', async () => {
          const { client, alice, exchangeId, idTokenB, toTokenB, toTokenA } = await deployExchangeFixture();
          await depositToken(client, alice, exchangeId, idTokenB, toTokenB(1000));
          await placeBuyOrder(client, alice, exchangeId, toTokenB(200), toTokenA(5));
          const currentId = await queryCurrentOrderId(client, exchangeId);
          const order = await queryBuyOrder(client, exchangeId, currentId.toNumber());
  
          expect(order.id).to.equal(currentId.toNumber());
          expect(order.price).to.equal(toTokenB(200));
          expect(order.volume).to.equal(toTokenA(5));
          expect(order.trader).to.equal(alice.address);
        });
      });
  
      describe('when there is matching sell order', () => {
        describe('when is whole fulfillment', () => {
          it('should trade one to one', async () => {
            const { client, alice, bob, exchangeId, idTokenB, idTokenA, toTokenA, toTokenB } = await deployExchangeFixture();
            
            await Promise.all([
              depositToken(client, alice, exchangeId, idTokenA, toTokenA(1)),
              depositToken(client, bob, exchangeId, idTokenB, toTokenB(1000)),
            ]);

            await placeSellOrder(client, alice, exchangeId, toTokenB(765), toTokenA(1));
            const { record } = await placeBuyOrder(client, bob, exchangeId, toTokenB(765), toTokenB(1));   

            const tradeEvent = eventsEmited(record, ethers.id("Trade(int64,int64,address,address)")) as Uint8Array [];

            expect(tradeEvent.length).to.be.equal(1);
  
            const parsedLog = AbiCoder.defaultAbiCoder().decode(
              ["int64", "int64", "address"],
              tradeEvent[0]
            );
            
            expect(parsedLog.length).to.equal(3);
            expect(parsedLog[0]).to.equal(BigInt(toTokenA(1)));
            expect(parsedLog[1]).to.equal(BigInt(toTokenB(765)));
            // expect(parsedLog[2].toLowerCase()).to.equal(alice.address);

          });
  
          it('should trade many to one', async () => {          
            const { client, alice, bob, charlie, david, exchangeId, idTokenB, idTokenA, toTokenA, toTokenB } = await deployExchangeFixture();

            await Promise.all([
              depositToken(client, alice, exchangeId, idTokenA, toTokenA(1)),
              depositToken(client, bob, exchangeId, idTokenA, toTokenA(1)),
              depositToken(client, charlie, exchangeId, idTokenA, toTokenA(1)),
              depositToken(client, david, exchangeId, idTokenB, toTokenB(2295)),
            ]); 


            await placeSellOrder(client, alice, exchangeId, toTokenB(765), toTokenA(1));
            await placeSellOrder(client, bob, exchangeId, toTokenB(765), toTokenA(1));
            await placeSellOrder(client, charlie, exchangeId, toTokenB(765), toTokenA(1));

            const { record } = await placeBuyOrder(client, david, exchangeId, toTokenB(765), toTokenA(3));   

            const tradeEvent = eventsEmited(record, ethers.id("Trade(int64,int64,address,address)")) as Uint8Array [];

            expect(tradeEvent.length).to.be.equal(3);
            
            const parsedLog1 = AbiCoder.defaultAbiCoder().decode(
              ["int64", "int64", "address"],
              tradeEvent[0]
            );
            
            expect(parsedLog1.length).to.equal(3);
            expect(parsedLog1[0]).to.equal(BigInt(toTokenA(1)));
            expect(parsedLog1[1]).to.equal(BigInt(toTokenB(765)));
            // expect(parsedLog1[2].toLowerCase()).to.equal(alice.address);

            const parsedLog2 = AbiCoder.defaultAbiCoder().decode(
              ["int64", "int64", "address"],
              tradeEvent[1]
            );
            
            expect(parsedLog2.length).to.equal(3);
            expect(parsedLog2[0]).to.equal(BigInt(toTokenA(1)));
            expect(parsedLog2[1]).to.equal(BigInt(toTokenB(765)));
            // expect(parsedLog2[2].toLowerCase()).to.equal(bob.address);

            const parsedLog3 = AbiCoder.defaultAbiCoder().decode(
              ["int64", "int64", "address"],
              tradeEvent[2]
            );
            
            expect(parsedLog3.length).to.equal(3);
            expect(parsedLog3[0]).to.equal(BigInt(toTokenA(1)));
            expect(parsedLog3[1]).to.equal(BigInt(toTokenB(765)));
            // expect(parsedLog3[2].toLowerCase()).to.equal(charlie.address);
  
          });
        });
  
        describe('when is partial fulfillment', () => {
          it('should trade and insert remainder volume', async () => {
            const { client, alice, bob, exchangeId, idTokenB, idTokenA, toTokenA, toTokenB } = await deployExchangeFixture();
            
            await Promise.all([
              depositToken(client, alice, exchangeId, idTokenA, toTokenA(2)),
              depositToken(client, bob, exchangeId, idTokenB, toTokenB(1590)),
            ]);

            await placeSellOrder(client, alice, exchangeId, toTokenB(795), toTokenA(1)); // sell only one
            const { record } = await placeBuyOrder(client, bob, exchangeId, toTokenB(795), toTokenA(2));   

            const tradeEvent = eventsEmited(record, ethers.id("Trade(int64,int64,address,address)")) as Uint8Array [];
            const newOrderEvent = eventsEmited(record, ethers.id("NewOrder(bool,uint256,address,int64,int64)")) as Uint8Array [];

            expect(tradeEvent.length).to.be.equal(1, "trade lengh error");
            expect(newOrderEvent.length).to.be.equal(1, "new order lengh error");
  
            const parsedLogTrade = AbiCoder.defaultAbiCoder().decode(
              ["int64", "int64", "address"],
              tradeEvent[0]
            );
            
            expect(parsedLogTrade.length).to.equal(3);
            expect(parsedLogTrade[0]).to.equal(BigInt(toTokenA(1)));
            expect(parsedLogTrade[1]).to.equal(BigInt(toTokenB(795)));
            // expect(parsedLogTrade[2].toLowerCase()).to.equal(alice.address);

            const parsedLogNewOrder = AbiCoder.defaultAbiCoder().decode(
              ["bool","uint256","address","int64","int64"],
              newOrderEvent[0]
            );

            expect(parsedLogNewOrder.length).to.equal(5);
            expect(parsedLogNewOrder[0]).to.equal(true);
            // expect(parsedLogNewOrder[1]).to.equal(765n);
            // expect(parsedLogNewOrder[2]).to.equal(765n);
            expect(parsedLogNewOrder[3]).to.equal(BigInt(toTokenB(795)));
            expect(parsedLogNewOrder[4]).to.equal(BigInt(toTokenB(1)));
  
          });
        });
      });
    });

    describe('.withdraw', () => {
      describe('when token is invalid', () => {
        it('should revert', async () => {
          const { client, exchangeId, alice } = await deployExchangeFixture();
          try {
            await withdrawToken(client, alice, exchangeId, ethers.ZeroAddress, 100)
            expect.fail("withdraw should have reverted but it did not.");
          } catch (error: any) {
            expect(error.message).to.exist;
          }
        });
      });
  
      describe('when amount is invalid', () => {
        it('should revert', async () => {
          const { exchangeId, client, alice, idTokenA, toTokenA } = await deployExchangeFixture();
  
          await depositToken(client, alice, exchangeId, idTokenA, toTokenA(100));
          try {
            await withdrawToken(client, alice, exchangeId, alice.address, 0);
            expect.fail("withdraw should have reverted but it did not.");
          } catch (error: any) {
            expect(error.message).to.exist;
          }
        });
      });
  
      describe('when trader has not enough balance', () => {
        it('should revert', async () => {
          const { exchangeId, client, alice, idTokenA, toTokenA } = await deployExchangeFixture();
  
          await depositToken(client, alice, exchangeId, idTokenA, toTokenA(100));
          try {
            await withdrawToken(client, alice, exchangeId, alice.address, toTokenA(101));
            expect.fail("withdraw should have reverted but it did not.");
          } catch (error: any) {
            expect(error.message).to.exist;
          }
        });
      });
  
      describe('when trader does not cancel a buy order', () => {
        it('it should revert', async () => {
          const { exchangeId, client, alice, idTokenB, toTokenB, toTokenA } = await deployExchangeFixture();
  
          await depositToken(client, alice, exchangeId, idTokenB, toTokenB(100));
          await placeBuyOrder(client, alice, exchangeId, toTokenB(100), toTokenA(1));

          try {
            await withdrawToken(client, alice, exchangeId, alice.address, toTokenB(100));
            expect.fail("withdraw should have reverted but it did not.");
          } catch (error: any) {
            expect(error.message).to.exist;
          }   
        });
      });
  
      describe('when trader has balance', () => {
        it('it should withdraw', async () => {
          const { exchangeId, client, alice, idTokenB, toTokenB } = await deployExchangeFixture();
          const addressTokenB = '0x' + idTokenB.toSolidityAddress();
          await depositToken(client, alice, exchangeId, idTokenB, toTokenB(100));
          
          const { record } = await withdrawToken(client, alice, exchangeId, addressTokenB, toTokenB(100));

          const withdrawEvent = eventsEmited(record, ethers.id("Withdraw(address,address,int64)")) as Uint8Array [];

          expect(withdrawEvent.length).to.be.equal(1, "withdraw lengh error");
  
          const parsedLogWithdraw = AbiCoder.defaultAbiCoder().decode(
            ["address", "address", "int64"],
            withdrawEvent[0]
          );
          
          expect(parsedLogWithdraw.length).to.be.equal(3);
          expect(parsedLogWithdraw[0].toLowerCase()).to.be.equal(alice.address);
          expect(parsedLogWithdraw[1].toLowerCase()).to.be.equal(addressTokenB);
          expect(parsedLogWithdraw[2]).to.be.equal(toTokenB(100));
        });
      });
    });

    describe('.deposit', () => {
      describe('when amount is invalid', () => {
        it('should revert', async () => {
          const { client, exchangeId, alice, idTokenA } = await deployExchangeFixture();
          try {
            await depositToken(client, alice, exchangeId, idTokenA, 0)
            expect.fail("withdraw should have reverted but it did not.");
          } catch (error: any) {
            expect(error.message).to.exist;
          }
        });
      });
  
      describe('when token is invalid', () => {
        it('should revert', async () => {
          it('should revert', async () => {
            const { client, exchangeId, alice, idTokenA, toTokenA } = await deployExchangeFixture();
            try {
              await depositToken(client, alice, exchangeId, ethers.ZeroAddress, toTokenA(100))
              expect.fail("withdraw should have reverted but it did not.");
            } catch (error: any) {
              expect(error.message).to.exist;
            }
          });
        });
      });
    });

    describe('.cancelOrder', () => {    
      describe('when order dont exists', () => {
        it('should revert', async () => {
          const { client, exchangeId, alice, idTokenA } = await deployExchangeFixture();
          
          const orderId = 0;

          try {
            await cancelOrder(client, alice, exchangeId, orderId, true);
            expect.fail("withdraw should have reverted but it did not.");
          } catch (error: any) {
            expect(error.message).to.exist;
          }
        });
      });
  
      describe('when order exists', () => {
        describe('when is Order', () => {
          describe('when caller is not the order owner', () => {
            it('should revert', async () => {
              const { client, exchangeId, alice, bob, idTokenA, toTokenA, toTokenB } = await deployExchangeFixture();

              await depositToken(client, alice, exchangeId, idTokenA, toTokenA(1));
              await placeSellOrder(client, alice, exchangeId, toTokenB(1), toTokenA(1));
              const orderId = await queryCurrentOrderId(client, exchangeId);

              try {
                await cancelOrder(client, bob, exchangeId, orderId.toNumber(), false);
                expect.fail("withdraw should have reverted but it did not.");
              } catch (error: any) {
                expect(error.message).to.exist;
              }
            });
          });
          describe('when order is fulfilled', () => {
            it('should revert', async () => {
              const { client, exchangeId, alice, bob, idTokenA, idTokenB, toTokenA, toTokenB } = await deployExchangeFixture();

              await depositToken(client, alice, exchangeId, idTokenA, toTokenA(1));
              await depositToken(client, bob, exchangeId, idTokenB, toTokenA(10));
              await placeSellOrder(client, alice, exchangeId, toTokenB(10), toTokenA(1));
              const orderId = await queryCurrentOrderId(client, exchangeId);
              await placeBuyOrder(client, bob, exchangeId, toTokenB(10), toTokenA(1));

              try {
                await cancelOrder(client, bob, exchangeId, orderId.toNumber(), false);
                expect.fail("withdraw should have reverted but it did not.");
              } catch (error: any) {
                expect(error.message).to.exist;
              }
            });
          });
    
          describe('when caller is the orders owner', () => {
            it('should cancel order and refund balance', async () => {
              const { client, exchangeId, alice, idTokenA, toTokenA, toTokenB } = await deployExchangeFixture();

              const addressTokenA = `0x${idTokenA.toSolidityAddress()}`;
              await depositToken(client, alice, exchangeId, idTokenA, toTokenA(207));
              const balance1 = await queryBalanceOfExchange(client, exchangeId, alice.address, addressTokenA);
              await placeSellOrder(client, alice, exchangeId, toTokenB(10), toTokenA(207));              
              const balance2 = await queryBalanceOfExchange(client, exchangeId, alice.address, addressTokenA);
              const orderId = await queryCurrentOrderId(client, exchangeId);         

              await cancelOrder(client, alice, exchangeId, orderId.toNumber(), false);
              const balance3 = await queryBalanceOfExchange(client, exchangeId, alice.address, addressTokenA);

              expect(balance2).to.be.equal(balance1.minus(toTokenA(207)));
              expect(balance3).to.be.equal(balance1);
    
            });
          });
        });
      });
    });
  });
});

