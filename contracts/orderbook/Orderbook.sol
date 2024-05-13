// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

abstract contract OrderBook {
    address public tokenA;
    address public tokenB;
    mapping(uint256 => Order) public buyOrders;
    mapping(uint256 => Order) public sellOrders;

    mapping(address => mapping(address => uint256)) public balanceOf;

    event Trade(uint256 tradedVolume, uint256 price, address indexed buyer, address seller);
    event NewOrder(bool isBuy, Order order);
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

    function _insertBuyOrder(uint256 firstOrderId, uint256 price, uint256 volume, address trader, uint256 lastOrderId) internal returns (uint256) {
        uint256 currentId = firstOrderId;
        uint256 lastId = 0;

        while (currentId != 0 && buyOrders[currentId].price > price) {
            lastId = currentId;
            currentId = buyOrders[currentId].next;
        }

        buyOrders[lastOrderId] = Order({
            id: lastOrderId,
            price: price,
            volume: volume,
            trader: trader,
            next: currentId
        });

        // remove tokenB balance because order was placed
        balanceOf[trader][tokenB] -= price * volume;

        emit NewOrder(true, buyOrders[lastOrderId]);

        if (lastId == 0) {
            return lastOrderId;
        } else {
            buyOrders[lastId].next = lastOrderId;
        }

        return firstOrderId;
    }

    function _insertSellOrder(uint256 firstOrderId, uint256 price, uint256 volume, address trader, uint256 lastOrderId) internal returns (uint256) {
        uint256 currentId = firstOrderId;
        uint256 lastId = 0;

        while (currentId != 0 && sellOrders[currentId].price < price) {
            lastId = currentId;
            currentId = sellOrders[currentId].next;
        }

        sellOrders[lastOrderId] = Order({
            id: lastOrderId,
            price: price,
            volume: volume,
            trader: trader,
            next: currentId
        });

        // remove balance because order was placed
        balanceOf[trader][tokenA] -= volume;

        emit NewOrder(false, sellOrders[lastOrderId]);

        if (lastId == 0) {
            return lastOrderId;
        } else {
            sellOrders[lastId].next = lastOrderId;
        }

        return firstOrderId;
    }

    function _matchBuyOrders(
        uint256 firstBuyOrderId,
        address sellTrader,
        uint256 sellPrice,
        uint256 sellVolume
    ) internal returns (uint256)  {
        uint256 currentBuyId = buyOrders[firstBuyOrderId].id; 

        while (currentBuyId != 0 && sellVolume > 0) {
            Order storage buyOrder = buyOrders[currentBuyId];

            if (sellPrice <= buyOrder.price) {
                uint256 tradedVolume = (buyOrder.volume < sellVolume) ? buyOrder.volume : sellVolume;
                uint256 tradedPrice = sellPrice;

                // trade
                balanceOf[sellTrader][tokenB] += tradedPrice * tradedVolume;

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
        uint256 firstSellOrderId,
        address buyTrader,
        uint256 buyPrice,
        uint256 buyVolume
    ) internal returns (uint256) {
        uint256 currentSellId = sellOrders[firstSellOrderId].id; 

        while (currentSellId != 0 && buyVolume > 0) {
            Order storage sellOrder = sellOrders[currentSellId];

            if (buyPrice >= sellOrder.price) {
                uint256 tradedVolume = (sellOrder.volume < buyVolume) ? sellOrder.volume : buyVolume;
                uint256 tradedPrice = sellOrder.price;


                // trade
                balanceOf[buyTrader][tokenB] -= tradedPrice * tradedVolume;
                balanceOf[buyTrader][tokenA] += tradedVolume;

                balanceOf[sellOrder.trader][tokenB] += tradedPrice * tradedVolume;

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
        IERC20(token).transferFrom(trader, address(this), amount);
        balanceOf[trader][token] += amount;
        emit Deposit(trader, token, amount);
    }

    function _withdraw(address trader, address token, uint256 amount) internal {
        balanceOf[trader][token] -= amount;
        IERC20(token).transfer(trader, amount);
        emit Withdraw(trader, token, amount);
    }

    function _cancelSellOrder(Order storage sellOrder, uint256 firstSellOrderId) internal {        
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

    function _cancelBuyOrder(Order storage buyOrder, uint256 firstBuyOrderId) internal {        
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
        balanceOf[buyOrder.trader][tokenB] += buyOrder.volume * buyOrder.price;
        buyOrder.volume = 0;
        
        emit OrderCanceled(true, buyOrder.id, msg.sender);
    }
}
