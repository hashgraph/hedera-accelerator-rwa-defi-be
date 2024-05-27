import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumberish } from 'ethers';
import { ethers } from 'hardhat';

async function deployExchangeFixture() {
  const [owner, alice, bob, charlie, david] = await ethers.getSigners();

  // Deploy Mock ERC20 tokens for tokenA and tokenB
  const Token = await ethers.getContractFactory("TestERC20");
  const tokenB = await Token.deploy("Token B", "TKB");
  const tokenA = await Token.deploy("Token A", "TKA");
  
  const addressTokenA = await tokenA.getAddress();
  const addressTokenB = await tokenB.getAddress();

  const exchange = await ethers.deployContract('Exchange', [tokenA, tokenB], owner);
  await exchange.waitForDeployment();

  const decimalsTokenA = await tokenA.decimals();
  const decimalsTokenB = await tokenB.decimals();

  const toTokenA = (_number: bigint) => {
    return _number * 10n ** decimalsTokenA;
  }

  const toTokenB = (_number: bigint) => {
    return _number * 10n ** decimalsTokenB;
  }

  // Token A config
  await tokenA.mint(alice.address, toTokenA(10000000000n) );
  await tokenA.mint(bob.address, toTokenA(10000000000n));
  await tokenA.mint(charlie.address, toTokenA(10000000000n));
  await tokenA.mint(david.address, toTokenA(10000000000n));

  await tokenA.connect(alice).approve(await exchange.getAddress(), toTokenA(10000000000n));
  await tokenA.connect(bob).approve(await exchange.getAddress(), toTokenA(10000000000n));
  await tokenA.connect(charlie).approve(await exchange.getAddress(), toTokenA(10000000000n));
  await tokenA.connect(david).approve(await exchange.getAddress(), toTokenA(10000000000n));

  // Token B config
  await tokenB.mint(alice.address, toTokenB(10000000000n));
  await tokenB.mint(bob.address, toTokenB(10000000000n));
  await tokenB.mint(charlie.address, toTokenB(10000000000n));
  await tokenB.mint(david.address, toTokenB(10000000000n));

  await tokenB.connect(alice).approve(await exchange.getAddress(), toTokenB(10000000000n));
  await tokenB.connect(bob).approve(await exchange.getAddress(), toTokenB(10000000000n));
  await tokenB.connect(charlie).approve(await exchange.getAddress(), toTokenB(10000000000n));
  await tokenB.connect(david).approve(await exchange.getAddress(), toTokenB(10000000000n));

  return {
    owner,
    alice,
    bob,
    charlie,
    david,
    exchange,
    tokenA,
    addressTokenA,
    toTokenA,
    tokenB,
    addressTokenB,
    toTokenB,
  }
}

describe('Exchange', () => {

  describe('.lastOrderId', () => {
    describe('when buy or sell order is placed', () => {
      it("should increment by 1", async function() {
        const { exchange, alice, bob, charlie, david, tokenB, tokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
  
        await exchange.connect(alice).deposit(tokenB, toTokenB(750n));
        await exchange.connect(alice).placeBuyOrder(toTokenB(150n), toTokenA(5n));
        expect(await exchange.currentOrderId()).to.equal(1);

        await exchange.connect(bob).deposit(tokenB, toTokenB(750n));
        await exchange.connect(bob).placeBuyOrder(toTokenB(150n), toTokenA(5n));
        expect(await exchange.currentOrderId()).to.equal(2);

        await exchange.connect(charlie).deposit(tokenB, toTokenB(750n));
        await exchange.connect(charlie).placeBuyOrder(toTokenB(150n), toTokenA(5n));
        expect(await exchange.currentOrderId()).to.equal(3);

        await exchange.connect(david).deposit(tokenA, toTokenA(5n));
        await exchange.connect(david).placeSellOrder(toTokenB(150n), toTokenA(5n));
        expect(await exchange.currentOrderId()).to.equal(3); // matched orders does not increment id

        await exchange.connect(david).deposit(tokenA, toTokenA(750n));
        await exchange.connect(david).placeBuyOrder(toTokenB(150n), toTokenA(5n));
        expect(await exchange.currentOrderId()).to.equal(4); // matched orders does not increment id

      });
    });
  });

  describe('.placeBuyOrder', () => {
    describe('when there is not matching sell order', () => {
      it('should place buy order', async () => {
        const { exchange, alice, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenB, toTokenB(1000n)); // price, volume
        await exchange.connect(alice).placeBuyOrder(toTokenB(100n), toTokenA(10n)); // price, volume
        const order = await exchange.buyOrders(1); // Accessing the first order

        expect(order.price).to.equal(toTokenB(100n));
        expect(order.volume).to.equal(toTokenA(10n));
        expect(order.trader).to.equal(alice.address);
        expect(order.next).to.equal(0); // No next order
      });

      it("should place buy orders sorted by highest price", async function () {
        const { exchange, alice, bob, charlie, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
  
        await exchange.connect(alice).deposit(addressTokenB, toTokenB(600n));
        await exchange.connect(bob).deposit(addressTokenB, toTokenB(750n));
        await exchange.connect(charlie).deposit(addressTokenB, toTokenB(4600n));

        await exchange.connect(alice).placeBuyOrder(toTokenB(200n), toTokenA(3n));
        await exchange.connect(bob).placeBuyOrder(toTokenB(150n), toTokenA(5n));
        await exchange.connect(charlie).placeBuyOrder(toTokenB(110n), toTokenA(10n));
        await exchange.connect(charlie).placeBuyOrder(toTokenB(100n), toTokenA(10n));
  
        const firstOrder = await exchange.buyOrders(1); // The order with the highest price
        const secondOrder = await exchange.buyOrders(2);
        const thirdOrder = await exchange.buyOrders(3);
        const fourthOrder = await exchange.buyOrders(4);
  
        expect(firstOrder.price).to.equal(toTokenB(200n));
        expect(secondOrder.price).to.equal(toTokenB(150n));
        expect(thirdOrder.price).to.equal(toTokenB(110n));
        expect(fourthOrder.price).to.equal(toTokenB(100n));
  
        expect(firstOrder.next).to.equal(2); // Points to second highest price
        expect(secondOrder.next).to.equal(3);
        expect(thirdOrder.next).to.equal(4); 
        expect(fourthOrder.next).to.equal(0); 

        // check if firstBuyOrderId is set correctly to the bid with the hihgest price
        expect(await exchange.firstBuyOrderId()).to.equal(1);

        await exchange.connect(charlie).placeBuyOrder(toTokenB(250n), toTokenA(10n));
        const fifthOrder_2 = await exchange.buyOrders(5);

        expect(await exchange.firstBuyOrderId()).to.equal(5); 
        expect(fifthOrder_2.next).to.equal(1); 
      });
    });

    describe('when there is matching sell order', () => {
      describe('when is whole fulfillment', () => {
        it('should trade one to one', async () => {
          const { exchange, alice, bob, addressTokenB, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
        
          await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
          await exchange.connect(bob).deposit(addressTokenB, toTokenB(1000n));

          await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n)); // price, volume
          const trade = await exchange.connect(bob).placeBuyOrder(toTokenB(100n), toTokenA(10n)); // price, volume

          await expect(trade).to.emit(exchange, 'Trade').withArgs(toTokenA(10n), toTokenB(100n), bob.address, alice.address);          

        });

        it('should trade many to one', async () => {
          const { exchange, alice, bob, charlie, david, addressTokenA, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, toTokenA(3n));
          await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(3n)); // price, volume

          await exchange.connect(bob).deposit(addressTokenA, toTokenA(6n));
          await exchange.connect(bob).placeSellOrder(toTokenB(100n), toTokenA(6n)); // price, volume

          await exchange.connect(charlie).deposit(addressTokenA, toTokenA(1n));
          await exchange.connect(charlie).placeSellOrder(toTokenB(100n), toTokenA(1n)); // price, volume
          const firstBuyOrderIdBefore = await exchange.firstBuyOrderId();
          
          await exchange.connect(david).deposit(addressTokenB, toTokenB(1000n));
          const trade = await exchange.connect(david).placeBuyOrder(toTokenB(100n), toTokenA(10n)); // price, volume
          await trade.wait();

          const firstBuyOrderIdAfter = await exchange.firstBuyOrderId();
          expect(firstBuyOrderIdBefore).to.equal(firstBuyOrderIdAfter); // should not insert buy order to storage

          const events = (await exchange.queryFilter(exchange.filters.Trade, -1));
          expect(events.length).to.equal(3);

          await expect(trade)
            .to.emit(exchange, 'Trade').withArgs(toTokenA(3n), toTokenB(100n), david.address, alice.address)
            .to.emit(exchange, 'Trade').withArgs(toTokenA(6n), toTokenB(100n), david.address, bob.address)
            .to.emit(exchange, 'Trade').withArgs(toTokenA(1n), toTokenB(100n), david.address, charlie.address)

        });
      });

      describe('when is partial fulfillment', () => {
        it('should trade and insert remainder volume', async () => {
          const { exchange, alice, bob, addressTokenA, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
          const tx = await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n)); // price, volume
          await tx.wait();

          await exchange.connect(bob).deposit(addressTokenB, toTokenB(1500n));
          const trade = await exchange.connect(bob).placeBuyOrder(toTokenB(100n), toTokenA(15n)); // price, volume
          await trade.wait();

          const events1 = (await exchange.queryFilter(exchange.filters.Trade, -1));
          expect(events1.length).to.equal(1);

          const events2 = (await exchange.queryFilter(exchange.filters.NewOrder, -2));
          expect(events2.length).to.equal(2);

          await expect(trade)
            .to.emit(exchange, 'Trade').withArgs(toTokenA(10n), toTokenB(100n), bob.address, alice.address)
            .to.emit(exchange, 'NewOrder').withArgs(true, 2, bob.address, toTokenB(100n), toTokenA(5n));

        });
      });
    });
  });

  describe('.placeSellOrder', () => {
    describe('when trying to place sell order', () => {
      it('should succeed', async () => {
        const { exchange, alice, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n)); // price, volume
        await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n)); // price, volume
        const order = await exchange.sellOrders(1); // Accessing the first order

        expect(order.price).to.equal(toTokenB(100n));
        expect(order.volume).to.equal(toTokenA(10n));
        expect(order.trader).to.equal(alice.address);
        expect(order.next).to.equal(0); // No next order
      });

      it("should insert sell orders sorted by lowest price", async function () {
        const { exchange, alice, bob, charlie, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
  
        await exchange.connect(alice).deposit(addressTokenA, toTokenA(5n));
        await exchange.connect(alice).placeSellOrder(toTokenB(150n), toTokenA(5n));
        
        await exchange.connect(bob).deposit(addressTokenA, toTokenA(3n));
        await exchange.connect(bob).placeSellOrder(toTokenB(200n), toTokenA(3n));

        await exchange.connect(charlie).deposit(addressTokenA, toTokenA(20n));
        await exchange.connect(charlie).placeSellOrder(toTokenB(100n), toTokenA(10n));
  
        const firstOrder = await exchange.sellOrders(3); // The order with the highest price
        const secondOrder = await exchange.sellOrders(1);
        const thirdOrder = await exchange.sellOrders(2);
  
        expect(firstOrder.price).to.equal(toTokenB(100n));
        expect(secondOrder.price).to.equal(toTokenB(150n));
        expect(thirdOrder.price).to.equal(toTokenB(200n));
  
        expect(firstOrder.next).to.equal(1); // Points to second highest price
        expect(secondOrder.next).to.equal(2); // Points to lowest price
        expect(thirdOrder.next).to.equal(0); // No next order

        // check if firstBuyOrderId is set correctly to the bid with the hihgest price
        expect(await exchange.firstSellOrderId()).to.equal(3);

        await exchange.connect(charlie).placeSellOrder(toTokenB(90n), toTokenA(10n));

        expect(await exchange.firstSellOrderId()).to.equal(4);
      });
    });
  });

  describe('.balanceOf', () => {
    describe('when a buy order is placed', () => {
      it('should not increase balanceOf token B', async () => {
        const { exchange, alice, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenB, toTokenB(13200n)); // price, volume
        await exchange.connect(alice).placeBuyOrder(toTokenB(100n), toTokenA(132n)); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenB())).to.be.equal(0);
      });

      it('should increase only remainder balance', async () => {
        const { exchange, alice, addressTokenB, toTokenA, toTokenB  } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenB, toTokenB(1000n));
        await exchange.connect(alice).placeBuyOrder(toTokenB(100n), toTokenA(5n)); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenB())).to.be.equal(toTokenB(500n));
      });
    });

    describe('when a sell order is placed', () => {
      it('should not increase balanceOf token A', async () => {
        const { exchange, alice, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenA, toTokenA(132n));
        await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(132n)); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(0);
      });

      it('should only increade remainder balance', async () => {
        const { exchange, alice, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenA, toTokenA(100n));
        await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(50n)); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(toTokenA(50n));
      });
      
    });

    describe('when a trade happens', () => {
      describe('when the price is the same', () => {
        it('should trade', async () => {
          const { exchange, alice, bob, charlie, david, addressTokenA, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, toTokenA(100n));
          await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(100n)); // price, volume

          await exchange.connect(bob).deposit(addressTokenA, toTokenA(30n));
          await exchange.connect(bob).placeSellOrder(toTokenB(100n), toTokenA(30n)); // price, volume

          await exchange.connect(charlie).deposit(addressTokenA, toTokenA(20n));
          await exchange.connect(charlie).placeSellOrder(toTokenB(100n), toTokenA(20n)); // price, volume

          await exchange.connect(david).deposit(addressTokenB, toTokenB(20000n));
          await exchange.connect(david).placeBuyOrder(toTokenB(100n), toTokenA(200n)); // price, volume

          expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(bob.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(charlie.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(david.address, await exchange.tokenA())).to.be.equal(toTokenA(150n));
          expect(await exchange.balanceOf(david.address, await exchange.tokenB())).to.be.equal(0);
        });
      });
      describe('when the price is different', () => {
        it('should trade with Market Price Priority', async () => {
          const { exchange, alice, bob, charlie, david, addressTokenA, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, toTokenA(100n));
          await exchange.connect(alice).placeSellOrder(toTokenB(99n), toTokenA(100n)); // price, volume

          await exchange.connect(bob).deposit(addressTokenA, toTokenA(30n));
          await exchange.connect(bob).placeSellOrder(toTokenB(100n), toTokenA(30n)); // price, volume

          await exchange.connect(charlie).deposit(addressTokenA, toTokenA(20n));
          await exchange.connect(charlie).placeSellOrder(toTokenB(100n), toTokenA(20n)); // price, volume

          await exchange.connect(david).deposit(addressTokenB, toTokenB(20000n));
          await exchange.connect(david).placeBuyOrder(toTokenB(100n), toTokenA(200n)); // price, volume

          expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(bob.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(charlie.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(david.address, await exchange.tokenA())).to.be.equal(toTokenA(150n));

          const deposited = toTokenB(20000n); // tokenB
          const traded = (toTokenB(100n * 20n)) + (toTokenB(100n *30n)) + (toTokenB(99n * 100n)); // tokenB
          const remainderCreated = toTokenB(100n * 50n); // tokenB

          expect(await exchange.balanceOf(david.address, await exchange.tokenB())).to.be.equal(deposited - traded - remainderCreated);

        });
      });
    });
  });

  describe('.withdraw', () => {
    describe('when token is invalid', () => {
      it('should revert', async () => {
        const { exchange, alice } = await loadFixture(deployExchangeFixture);

        await expect(exchange.connect(alice).withdraw(ethers.ZeroAddress, 100))
          .to.be.revertedWith('Invalid token');
      });
    });

    describe('when amount is invalid', () => {
      it('should revert', async () => {
        const { exchange, alice, addressTokenA, toTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, toTokenA(1000n));
        await expect(exchange.connect(alice).withdraw(addressTokenA, 0))
          .to.be.revertedWith('Invalid amount');
      });
    });

    describe('when trader has not enough balance', () => {
      it('should revert', async () => {
        const { exchange, alice, addressTokenA, toTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, toTokenA(999n));
        await expect(exchange.connect(alice).withdraw(addressTokenA, toTokenA(1000n)))
          .to.be.revertedWith('Not enough balance');
      });
    });

    describe('when trader does not cancel a buy order', () => {
      it('it should revert', async () => {
        const { exchange, alice, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenB, toTokenB(1000n));
        await exchange.connect(alice).placeBuyOrder(toTokenB(100n), toTokenA(10n));

        await expect(exchange.connect(alice).withdraw(addressTokenB, toTokenB(10n)))
          .to.be.revertedWith('Not enough balance');        
      });
    });

    describe('when trader does not cancel a sell order', () => {
      it('it should revert', async () => {
        const { exchange, alice, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
        await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n));
        await expect(exchange.connect(alice).withdraw(addressTokenA, toTokenA(10n)))
          .to.be.revertedWith('Not enough balance');        
      });
    });

    describe('when trader does not cancel the order', () => {
      it('it should revert', async () => {
        const { exchange, alice, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
        await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n));
        await expect(exchange.connect(alice).withdraw(addressTokenA, toTokenA(10n)))
          .to.be.revertedWith('Not enough balance');        
      });
    });

    describe('when trader has balance', () => {
      it('it should withdraw', async () => {
        const { exchange, alice, addressTokenA, toTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
        expect(await exchange.balanceOf(alice.address, addressTokenA)).to.equal(toTokenA(10n));
        
        const withdraw = await exchange.connect(alice).withdraw(addressTokenA, toTokenA(10n));
        expect(await exchange.balanceOf(alice.address, addressTokenA)).to.equal(0);

        expect(withdraw).to.emit(exchange, "Withdraw").withArgs(alice.address, addressTokenA, toTokenA(10n));

      });
    });
  });

  describe('.deposit', () => {
    describe('when amount is invalid', () => {
      it('should revert', async () => {
        const { exchange, alice, addressTokenA, toTokenA } = await loadFixture(deployExchangeFixture);

        await expect(exchange.connect(alice).deposit(addressTokenA, toTokenA(0n)))
          .to.be.revertedWith('Invalid amount');
      });
    });

    describe('when token is invalid', () => {
      it('should revert', async () => {
        const { exchange, alice } = await loadFixture(deployExchangeFixture);

        await expect(exchange.connect(alice).deposit(ethers.ZeroAddress, 100))
          .to.be.revertedWith('Invalid token');
      });
    });

    describe('when deposit is valid', () => {
      it('should deposit', async () => {
        const { exchange, alice, addressTokenA, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, toTokenA(100n));
        await exchange.connect(alice).deposit(addressTokenB, toTokenB(1000n));

        expect(await exchange.balanceOf(alice.address, addressTokenA)).to.equal(toTokenA(100n))
        expect(await exchange.balanceOf(alice.address, addressTokenB)).to.equal(toTokenB(1000n))
      });
    });
  });

  describe('.cancelOrder', () => {    
    describe('when order dont exists', () => {
      it('should revert', async () => {
        const { exchange, alice } = await loadFixture(deployExchangeFixture);

        await expect(exchange.connect(alice).cancelOrder(1, true)).to.be.revertedWith('Order do not exists');
      });
    });

    describe('when order exists', () => {
      describe('when is buy Order', () => {
        describe('when caller is not the order owner', () => {
          it('should revert', async () => {
            const { exchange, alice, bob, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenB, toTokenB(1000n));
            await exchange.connect(alice).placeBuyOrder(toTokenB(100n), toTokenA(10n));
            await expect(exchange.connect(bob).cancelOrder(1, true)).to.be.revertedWith('Only the order creator can cancel this order');
          });
        });
        describe('when order is fulfilled', () => {
          it('should revert', async () => {
            const { exchange, alice, bob, addressTokenA, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenB, toTokenB(1000n));
            await exchange.connect(alice).placeBuyOrder(toTokenB(100n), toTokenA(10n));
            await exchange.connect(bob).deposit(addressTokenA, toTokenA(10n));
            await exchange.connect(bob).placeSellOrder(toTokenB(100n), toTokenA(10n));
  
            await expect(exchange.connect(alice).cancelOrder(1, true)).to.be.revertedWith('Order do not exists');
          });
        });
  
        describe('when caller is the orders owner', () => {
          it('should cancel order and refund balance', async () => {
            const { exchange, alice, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenB, toTokenB(1000n));
            await exchange.connect(alice).placeBuyOrder(toTokenB(100n), toTokenA(10n));
  
            expect(await exchange.balanceOf(alice.address, addressTokenB)).to.be.equal(0);
  
            const cancelation = await exchange.connect(alice).cancelOrder(1, true);
  
            expect(await exchange.balanceOf(alice.address, addressTokenB)).to.be.equal(toTokenB(1000n));
  
            await expect(cancelation).to.emit(exchange, 'OrderCanceled').withArgs(true, 1, alice.address);          
  
          });
        });
      });

      describe('when is sell Order', () => {
        describe('when caller is not the order owner', () => {
          it('should revert', async () => {
            const { exchange, alice, bob, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
            await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n));
            await expect(exchange.connect(bob).cancelOrder(1, false)).to.be.revertedWith('Only the order creator can cancel this order');
          });
        });

        describe('when order is fulfilled', () => {
          it('should revert', async () => {
            const { exchange, alice, bob, addressTokenA, addressTokenB, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
            await exchange.connect(bob).deposit(addressTokenB, toTokenB(1000n));
            
            await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n));
            await exchange.connect(bob).placeBuyOrder(toTokenB(100n), toTokenA(10n));
  
            await expect(exchange.connect(alice).cancelOrder(1, false)).to.be.revertedWith('Order do not exists');
          });
        });
  
        describe('when caller is the orders owner', () => {
          it('should cancel order and refund balance', async () => {
            const { exchange, alice, addressTokenA, toTokenA, toTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenA, toTokenA(10n));
            await exchange.connect(alice).placeSellOrder(toTokenB(100n), toTokenA(10n));
  
            expect(await exchange.balanceOf(alice.address, addressTokenA)).to.be.equal(0);
  
            const cancelation = await exchange.connect(alice).cancelOrder(1, false);
  
            expect(await exchange.balanceOf(alice.address, addressTokenA)).to.be.equal(toTokenA(10n));
  
            await expect(cancelation).to.emit(exchange, 'OrderCanceled').withArgs(false, 1, alice.address);          
  
          });
        });
      });
    });
  });
});
