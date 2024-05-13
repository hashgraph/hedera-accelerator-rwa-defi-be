import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
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

  // Token A config
  await tokenA.mint(alice.address, 10000000000);
  await tokenA.mint(bob.address, 10000000000);
  await tokenA.mint(charlie.address, 10000000000);
  await tokenA.mint(david.address, 10000000000);

  await tokenA.connect(alice).approve(await exchange.getAddress(), 10000000000);
  await tokenA.connect(bob).approve(await exchange.getAddress(), 10000000000);
  await tokenA.connect(charlie).approve(await exchange.getAddress(), 10000000000);
  await tokenA.connect(david).approve(await exchange.getAddress(), 10000000000);

  // Token B config
  await tokenB.mint(alice.address, 10000000000);
  await tokenB.mint(bob.address, 10000000000);
  await tokenB.mint(charlie.address, 10000000000);
  await tokenB.mint(david.address, 10000000000);

  await tokenB.connect(alice).approve(await exchange.getAddress(), 10000000000);
  await tokenB.connect(bob).approve(await exchange.getAddress(), 10000000000);
  await tokenB.connect(charlie).approve(await exchange.getAddress(), 10000000000);
  await tokenB.connect(david).approve(await exchange.getAddress(), 10000000000);

  return {
    owner,
    alice,
    bob,
    charlie,
    david,
    exchange,
    tokenA,
    addressTokenA,
    tokenB,
    addressTokenB
  }
}

describe('Exchange', () => {

  describe('.lastOrderId', () => {
    describe('when buy or sell order is placed', () => {
      it("should increment by 1", async function() {
        const { exchange, alice, bob, charlie, david, tokenB, tokenA } = await loadFixture(deployExchangeFixture);
  
        await exchange.connect(alice).deposit(tokenB, 750);
        await exchange.connect(alice).placeBuyOrder(150, 5);
        expect(await exchange.lastOrderId()).to.equal(1);

        await exchange.connect(bob).deposit(tokenB, 750);
        await exchange.connect(bob).placeBuyOrder(150, 5);
        expect(await exchange.lastOrderId()).to.equal(2);

        await exchange.connect(charlie).deposit(tokenB, 750);
        await exchange.connect(charlie).placeBuyOrder(150, 5);
        expect(await exchange.lastOrderId()).to.equal(3);

        await exchange.connect(david).deposit(tokenA, 5);
        await exchange.connect(david).placeSellOrder(150, 5);
        expect(await exchange.lastOrderId()).to.equal(4);

      });
    });
  });

  describe('.placeBuyOrder', () => {
    describe('when there is not matching sell order', () => {
      it('should place buy order', async () => {
        const { exchange, alice, addressTokenB, addressTokenA } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenB, 1000); // price, volume
        await exchange.connect(alice).placeBuyOrder(100, 10); // price, volume
        const order = await exchange.buyOrders(1); // Accessing the first order

        expect(order.price).to.equal(100);
        expect(order.volume).to.equal(10);
        expect(order.trader).to.equal(alice.address);
        expect(order.next).to.equal(0); // No next order
      });

      it("should place buy orders sorted by highest price", async function () {
        const { exchange, alice, bob, charlie, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);
  
        await exchange.connect(alice).deposit(addressTokenB, 750);
        await exchange.connect(alice).placeBuyOrder(150, 5);

        await exchange.connect(bob).deposit(addressTokenB, 600);
        await exchange.connect(bob).placeBuyOrder(200, 3);

        await exchange.connect(charlie).deposit(addressTokenB, 4600);
        await exchange.connect(charlie).placeBuyOrder(100, 10);
        await exchange.connect(charlie).placeBuyOrder(110, 10);
  
        const firstOrder = await exchange.buyOrders(2); // The order with the highest price
        const secondOrder = await exchange.buyOrders(1);
        const thirdOrder = await exchange.buyOrders(3);
  
        expect(firstOrder.price).to.equal(200);
        expect(secondOrder.price).to.equal(150);
        expect(thirdOrder.price).to.equal(100);
  
        expect(firstOrder.next).to.equal(1); // Points to second highest price
        expect(secondOrder.next).to.equal(4); // Points to lowest price
        expect(thirdOrder.next).to.equal(0); // No next order

        // check if firstBuyOrderId is set correctly to the bid with the hihgest price
        expect(await exchange.firstBuyOrderId()).to.equal(2);

        await exchange.connect(charlie).placeBuyOrder(250, 10);

        expect(await exchange.firstBuyOrderId()).to.equal(5);
      });
    });

    describe('when there is matching sell order', () => {
      describe('when is whole fulfillment', () => {
        it('should trade one to one', async () => {
          const { exchange, alice, bob, addressTokenB, addressTokenA } = await loadFixture(deployExchangeFixture);
        
          await exchange.connect(alice).deposit(addressTokenA, 10);
          await exchange.connect(alice).placeSellOrder(100, 10); // price, volume

          await exchange.connect(bob).deposit(addressTokenB, 1000);
          const trade = await exchange.connect(bob).placeBuyOrder(100, 10); // price, volume

          await trade.wait();

          await expect(trade).to.emit(exchange, 'Trade').withArgs(10, 100, bob.address, alice.address);          

        });

        it('should trade many to one', async () => {
          const { exchange, alice, bob, charlie, david, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, 3);
          await exchange.connect(alice).placeSellOrder(100, 3); // price, volume

          await exchange.connect(bob).deposit(addressTokenA, 6);
          await exchange.connect(bob).placeSellOrder(100, 6); // price, volume

          await exchange.connect(charlie).deposit(addressTokenA, 1);
          await exchange.connect(charlie).placeSellOrder(100, 1); // price, volume
          const firstBuyOrderIdBefore = await exchange.firstBuyOrderId();
          
          await exchange.connect(david).deposit(addressTokenB, 1000);
          const trade = await exchange.connect(david).placeBuyOrder(100, 10); // price, volume
          await trade.wait();

          const firstBuyOrderIdAfter = await exchange.firstBuyOrderId();
          expect(firstBuyOrderIdBefore).to.equal(firstBuyOrderIdAfter); // should not insert buy order to storage

          const events = (await exchange.queryFilter(exchange.filters.Trade, -1));
          expect(events.length).to.equal(3);

          await expect(trade)
            .to.emit(exchange, 'Trade').withArgs(3, 100, david.address, alice.address)
            .to.emit(exchange, 'Trade').withArgs(6, 100, david.address, bob.address)
            .to.emit(exchange, 'Trade').withArgs(1, 100, david.address, charlie.address)

        });
      });

      describe('when is partial fulfillment', () => {
        it('should trade and insert remainder volume', async () => {
          const { exchange, alice, bob, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, 10);
          const tx = await exchange.connect(alice).placeSellOrder(100, 10); // price, volume
          await tx.wait();

          await exchange.connect(bob).deposit(addressTokenB, 1500);
          const trade = await exchange.connect(bob).placeBuyOrder(100, 15); // price, volume
          await trade.wait();

          const events1 = (await exchange.queryFilter(exchange.filters.Trade, -1));
          expect(events1.length).to.equal(1);

          const events2 = (await exchange.queryFilter(exchange.filters.NewOrder, -2));
          expect(events2.length).to.equal(2);

          await expect(trade)
            .to.emit(exchange, 'Trade').withArgs(10, 100, bob.address, alice.address)
            .to.emit(exchange, 'NewOrder').withArgs(true, [2, 100, 5, bob.address, 0 ]);

        });
      });
    });
  });

  describe('.placeSellOrder', () => {
    describe('when trying to place sell order', () => {
      it('should succeed', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenA, 10); // price, volume
        await exchange.connect(alice).placeSellOrder(100, 10); // price, volume
        const order = await exchange.sellOrders(1); // Accessing the first order

        expect(order.price).to.equal(100);
        expect(order.volume).to.equal(10);
        expect(order.trader).to.equal(alice.address);
        expect(order.next).to.equal(0); // No next order
      });

      it("should insert sell orders sorted by lowest price", async function () {
        const { exchange, alice, bob, charlie, addressTokenA } = await loadFixture(deployExchangeFixture);
  
        await exchange.connect(alice).deposit(addressTokenA, 5);
        await exchange.connect(alice).placeSellOrder(150, 5);
        
        await exchange.connect(bob).deposit(addressTokenA, 3);
        await exchange.connect(bob).placeSellOrder(200, 3);

        await exchange.connect(charlie).deposit(addressTokenA, 20);
        await exchange.connect(charlie).placeSellOrder(100, 10);
  
        const firstOrder = await exchange.sellOrders(3); // The order with the highest price
        const secondOrder = await exchange.sellOrders(1);
        const thirdOrder = await exchange.sellOrders(2);
  
        expect(firstOrder.price).to.equal(100);
        expect(secondOrder.price).to.equal(150);
        expect(thirdOrder.price).to.equal(200);
  
        expect(firstOrder.next).to.equal(1); // Points to second highest price
        expect(secondOrder.next).to.equal(2); // Points to lowest price
        expect(thirdOrder.next).to.equal(0); // No next order

        // check if firstBuyOrderId is set correctly to the bid with the hihgest price
        expect(await exchange.firstSellOrderId()).to.equal(3);

        await exchange.connect(charlie).placeSellOrder(90, 10);

        expect(await exchange.firstSellOrderId()).to.equal(4);
      });
    });
  });

  describe('.balanceOf', () => {
    describe('when a buy order is placed', () => {
      it('should not increase balanceOf token B', async () => {
        const { exchange, alice, addressTokenB } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenB, 13200); // price, volume
        await exchange.connect(alice).placeBuyOrder(100, 132); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenB())).to.be.equal(0);
      });

      it('should increase only remainder balance', async () => {
        const { exchange, alice, addressTokenB } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenB, 1000);
        await exchange.connect(alice).placeBuyOrder(100, 5); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenB())).to.be.equal(500);
      });
    });

    describe('when a sell order is placed', () => {
      it('should not increase balanceOf token A', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenA, 132);
        await exchange.connect(alice).placeSellOrder(100, 132); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(0);
      });

      it('should only increade remainder balance', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);
        
        await exchange.connect(alice).deposit(addressTokenA, 100);
        await exchange.connect(alice).placeSellOrder(100, 50); // price, volume

        expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(50);
      });
      
    });

    describe('when a trade happens', () => {
      describe('when the price is the same', () => {
        it('should trade', async () => {
          const { exchange, alice, bob, charlie, david, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, 100);
          await exchange.connect(alice).placeSellOrder(100, 100); // price, volume

          await exchange.connect(bob).deposit(addressTokenA, 30);
          await exchange.connect(bob).placeSellOrder(100, 30); // price, volume

          await exchange.connect(charlie).deposit(addressTokenA, 20);
          await exchange.connect(charlie).placeSellOrder(100, 20); // price, volume

          await exchange.connect(david).deposit(addressTokenB, 20000);
          await exchange.connect(david).placeBuyOrder(100, 200); // price, volume

          expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(bob.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(charlie.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(david.address, await exchange.tokenA())).to.be.equal(150);
          expect(await exchange.balanceOf(david.address, await exchange.tokenB())).to.be.equal(0);
        });
      });
      describe('when the price is different', () => {
        it('should trade with Market Price Priority', async () => {
          const { exchange, alice, bob, charlie, david, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);
          
          await exchange.connect(alice).deposit(addressTokenA, 100);
          await exchange.connect(alice).placeSellOrder(99, 100); // price, volume

          await exchange.connect(bob).deposit(addressTokenA, 30);
          await exchange.connect(bob).placeSellOrder(100, 30); // price, volume

          await exchange.connect(charlie).deposit(addressTokenA, 20);
          await exchange.connect(charlie).placeSellOrder(100, 20); // price, volume

          await exchange.connect(david).deposit(addressTokenB, 20000);
          await exchange.connect(david).placeBuyOrder(100, 200); // price, volume

          expect(await exchange.balanceOf(alice.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(bob.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(charlie.address, await exchange.tokenA())).to.be.equal(0);
          expect(await exchange.balanceOf(david.address, await exchange.tokenA())).to.be.equal(150);

          const deposited = 20000; // tokenB
          const traded = (100 * 20) + (100 * 30) + (99 * 100); // tokenB
          const remainderCreated = 100 * 50; // tokenB

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
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, 1000);
        await expect(exchange.connect(alice).withdraw(addressTokenA, 0))
          .to.be.revertedWith('Invalid amount');
      });
    });

    describe('when trader has not enough balance', () => {
      it('should revert', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, 999);
        await expect(exchange.connect(alice).withdraw(addressTokenA, 1000))
          .to.be.revertedWith('Not enough balance');
      });
    });

    describe('when trader does not cancel a buy order', () => {
      it('it should revert', async () => {
        const { exchange, alice, addressTokenB } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenB, 1000);
        await exchange.connect(alice).placeBuyOrder(100, 10);

        await expect(exchange.connect(alice).withdraw(addressTokenB, 10))
          .to.be.revertedWith('Not enough balance');        
      });
    });

    describe('when trader does not cancel a sell order', () => {
      it('it should revert', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, 10);
        await exchange.connect(alice).placeSellOrder(100, 10);
        await expect(exchange.connect(alice).withdraw(addressTokenA, 10))
          .to.be.revertedWith('Not enough balance');        
      });
    });

    describe('when trader does not cancel the order', () => {
      it('it should revert', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, 10);
        await exchange.connect(alice).placeSellOrder(100, 10);
        await expect(exchange.connect(alice).withdraw(addressTokenA, 10))
          .to.be.revertedWith('Not enough balance');        
      });
    });

    describe('when trader has balance', () => {
      it('it should withdraw', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, 10);
        expect(await exchange.balanceOf(alice.address, addressTokenA)).to.equal(10);
        
        const withdraw = await exchange.connect(alice).withdraw(addressTokenA, 10);
        expect(await exchange.balanceOf(alice.address, addressTokenA)).to.equal(0);

        expect(withdraw).to.emit(exchange, "Withdraw").withArgs(alice.address, addressTokenA, 10);

      });
    });
  });

  describe('.deposit', () => {
    describe('when amount is invalid', () => {
      it('should revert', async () => {
        const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);

        await expect(exchange.connect(alice).deposit(addressTokenA, 0))
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
        const { exchange, alice, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);

        await exchange.connect(alice).deposit(addressTokenA, 100);
        await exchange.connect(alice).deposit(addressTokenB, 1000);

        expect(await exchange.balanceOf(alice.address, addressTokenA)).to.equal(100)
        expect(await exchange.balanceOf(alice.address, addressTokenB)).to.equal(1000)
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
            const { exchange, alice, bob, addressTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenB, 1000);
            await exchange.connect(alice).placeBuyOrder(100, 10);
            await expect(exchange.connect(bob).cancelOrder(1, true)).to.be.revertedWith('Only the order creator can cancel this order');
          });
        });
        describe('when order is fulfilled', () => {
          it('should revert', async () => {
            const { exchange, alice, bob, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenB, 1000);
            await exchange.connect(alice).placeBuyOrder(100, 10);
            await exchange.connect(bob).deposit(addressTokenA, 10);
            await exchange.connect(bob).placeSellOrder(100, 10);
  
            await expect(exchange.connect(alice).cancelOrder(1, true)).to.be.revertedWith('Order already cancelled or fulfilled');
          });
        });
  
        describe('when caller is the orders owner', () => {
          it('should cancel order and refund balance', async () => {
            const { exchange, alice, addressTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenB, 1000);
            await exchange.connect(alice).placeBuyOrder(100, 10);
  
            expect(await exchange.balanceOf(alice.address, addressTokenB)).to.be.equal(0);
  
            const cancelation = await exchange.connect(alice).cancelOrder(1, true);
  
            expect(await exchange.balanceOf(alice.address, addressTokenB)).to.be.equal(1000);
  
            await expect(cancelation).to.emit(exchange, 'OrderCanceled').withArgs(true, 1, alice.address);          
  
          });
        });
      });

      describe('when is sell Order', () => {
        describe('when caller is not the order owner', () => {
          it('should revert', async () => {
            const { exchange, alice, bob, addressTokenA } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenA, 10);
            await exchange.connect(alice).placeSellOrder(100, 10);
            await expect(exchange.connect(bob).cancelOrder(1, false)).to.be.revertedWith('Only the order creator can cancel this order');
          });
        });

        describe('when order is fulfilled', () => {
          it('should revert', async () => {
            const { exchange, alice, bob, addressTokenA, addressTokenB } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenA, 10);
            await exchange.connect(alice).placeSellOrder(100, 10);
            await exchange.connect(bob).deposit(addressTokenB, 1000);
            await exchange.connect(bob).placeBuyOrder(100, 10);
  
            await expect(exchange.connect(alice).cancelOrder(1, false)).to.be.revertedWith('Order already cancelled or fulfilled');
          });
        });
  
        describe('when caller is the orders owner', () => {
          it('should cancel order and refund balance', async () => {
            const { exchange, alice, addressTokenA } = await loadFixture(deployExchangeFixture);
            await exchange.connect(alice).deposit(addressTokenA, 10);
            await exchange.connect(alice).placeSellOrder(100, 10);
  
            expect(await exchange.balanceOf(alice.address, addressTokenA)).to.be.equal(0);
  
            const cancelation = await exchange.connect(alice).cancelOrder(1, false);
  
            expect(await exchange.balanceOf(alice.address, addressTokenA)).to.be.equal(10);
  
            await expect(cancelation).to.emit(exchange, 'OrderCanceled').withArgs(false, 1, alice.address);          
  
          });
        });
      });
    });
  });
});
