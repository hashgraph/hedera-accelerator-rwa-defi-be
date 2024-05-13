// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

abstract contract OrderBook {
    address public tokenA;
    address public tokenB;
    mapping(uint256 => Order) public buyOrders;
    mapping(uint256 => Order) public sellOrders;
    mapping(address => mapping(address => uint256)) public balanceOf;
    uint256 public firstBuyOrderId;
    uint256 public firstSellOrderId;
    uint256 public currentOrderId;

    event Trade(uint256 tradedVolume, uint256 price, address indexed buyer, address seller);
    event NewOrder(bool isBuy, uint256 orderId, address trader, uint256 price, uint256 volume);
    event Deposit(address indexed trader, address token, uint256 amount);
    event Withdraw(address indexed trader, address token, uint256 amount);
    event OrderCanceled(bool isBuy, uint256 indexed orderId, address indexed trader);

    struct Order {
        uint256 id;
        uint256 price;
        uint256 volume;
        address trader;
        uint256 next;
    }

    function _insertBuyOrder(address trader, uint256 price, uint256 volume) internal {
        uint256 currentId = firstBuyOrderId;
        uint256 lastId = 0;

        while (currentId != 0 && buyOrders[currentId].price > price) {
            lastId = currentId;
            currentId = buyOrders[currentId].next;
        }

        buyOrders[currentOrderId] = Order({
            id: currentOrderId,
            price: price,
            volume: volume,
            trader: trader,
            next: currentId
        });

        // remove tokenB balance because order was placed
        balanceOf[trader][tokenB] -= price * (volume / 10 ** ERC20(tokenA).decimals());

        emit NewOrder(true, currentOrderId, trader, price, volume);

        if (lastId == 0) {
            firstBuyOrderId = currentOrderId;
        } else {
            buyOrders[lastId].next = currentOrderId;
        }
    }

    function _insertSellOrder(address trader, uint256 price, uint256 volume) internal {
        uint256 currentId = firstSellOrderId;
        uint256 lastId = 0;

        while (currentId != 0 && sellOrders[currentId].price < price) {
            lastId = currentId;
            currentId = sellOrders[currentId].next;
        }

        sellOrders[currentOrderId] = Order({
            id: currentOrderId,
            price: price,
            volume: volume,
            trader: trader,
            next: currentId
        });

        // remove balance because order was placed
        balanceOf[trader][tokenA] -= volume;

        emit NewOrder(false, currentOrderId, trader, price, volume);

        if (lastId == 0) {
            firstSellOrderId = currentOrderId;
        } else {
            sellOrders[lastId].next = currentOrderId;
        }
    }

    function _matchBuyOrders(
        address sellTrader,
        uint256 sellPrice,
        uint256 sellVolume
    ) internal returns (uint256)  {
        uint256 currentBuyId = buyOrders[firstBuyOrderId].id; 
        uint256 decimals = ERC20(tokenA).decimals();

        while (currentBuyId != 0 && sellVolume > 0) {
            Order storage buyOrder = buyOrders[currentBuyId];

            if (sellPrice <= buyOrder.price) {
                uint256 tradedVolume = (buyOrder.volume < sellVolume) ? buyOrder.volume : sellVolume;
                uint256 tradedPrice = sellPrice;

                // trade
                balanceOf[sellTrader][tokenB] += tradedPrice * (tradedVolume / 10 ** decimals);

                balanceOf[sellTrader][tokenA] -= tradedVolume;
                balanceOf[buyOrder.trader][tokenA] += tradedVolume;
                
                sellVolume -= tradedVolume;
                buyOrder.volume -= tradedVolume;

                emit Trade(tradedVolume, buyOrder.price, sellTrader, buyOrder.trader);

                if (buyOrder.volume == 0) {
                    currentBuyId = buyOrder.next;
                }
            } else {
                break; // No more matches possible
            }
        }

        return sellVolume;
    }

    function _matchSellOrders(
        address buyTrader,
        uint256 buyPrice,
        uint256 buyVolume
    ) internal returns (uint256) {
        uint256 currentSellId = sellOrders[firstSellOrderId].id; 
        uint256 decimals = ERC20(tokenA).decimals();

        while (currentSellId != 0 && buyVolume > 0) {
            Order storage sellOrder = sellOrders[currentSellId];

            if (buyPrice >= sellOrder.price) {
                uint256 tradedVolume = (sellOrder.volume < buyVolume) ? sellOrder.volume : buyVolume;
                uint256 tradedPrice = sellOrder.price;


                // trade
                balanceOf[buyTrader][tokenB] -= tradedPrice * (tradedVolume / 10 ** decimals);
                balanceOf[buyTrader][tokenA] += tradedVolume;

                balanceOf[sellOrder.trader][tokenB] += tradedPrice * (tradedVolume / 10 ** decimals);

                // diminui tradedVolume de buyVolume e sellVolume
                buyVolume -= tradedVolume;
                sellOrder.volume -= tradedVolume;

                emit Trade(tradedVolume, sellOrder.price, buyTrader, sellOrder.trader);

                if (sellOrder.volume == 0) {
                    currentSellId = sellOrder.next;
                }
            } else {
                // since the sell order book is sorter by the lowest price
                // no more matches possible and we interrupt the loop.
                break; 
            }
        }

        return buyVolume;
    }

    function _deposit(address trader, address token, uint256 amount) internal {
        ERC20(token).transferFrom(trader, address(this), amount);
        balanceOf[trader][token] += amount;
        emit Deposit(trader, token, amount);
    }

    function _withdraw(address trader, address token, uint256 amount) internal {
        balanceOf[trader][token] -= amount;
        ERC20(token).transfer(trader, amount);
        emit Withdraw(trader, token, amount);
    }

    function _cancelSellOrder(Order storage sellOrder) internal {        
        if (sellOrder.id == firstSellOrderId) {
            firstSellOrderId = sellOrder.next;
        } else {
            // Find the previous order
            Order storage currentOrder = sellOrders[firstSellOrderId];

            while (currentOrder.next != sellOrder.id) {
                require(currentOrder.next != 0, "Order not found");
                currentOrder = sellOrders[currentOrder.next];
            }
            // Adjust pointers
            currentOrder.next = sellOrder.next;
        }

        // refund balance to trader
        balanceOf[sellOrder.trader][tokenA] += sellOrder.volume;
        sellOrder.volume = 0;
        
        emit OrderCanceled(false, sellOrder.id, msg.sender);
    }

    function _cancelBuyOrder(Order storage buyOrder) internal {        
        if (buyOrder.id == firstBuyOrderId) {
            firstBuyOrderId = buyOrder.next;
        } else {
            // Find the previous order
            Order storage currentOrder = buyOrders[firstBuyOrderId];

            while (currentOrder.next != buyOrder.id) {
                require(currentOrder.next != 0, "Order not found");
                currentOrder = buyOrders[currentOrder.next];
            }
            // Adjust pointers
            currentOrder.next = buyOrder.next;
        }

        // refund balance to trader
        balanceOf[buyOrder.trader][tokenB] += buyOrder.price * (buyOrder.volume / 10 ** ERC20(tokenA).decimals());
        buyOrder.volume = 0;
        
        emit OrderCanceled(true, buyOrder.id, msg.sender);
    }
}
