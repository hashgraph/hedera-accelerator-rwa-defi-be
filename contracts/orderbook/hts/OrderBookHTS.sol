// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../../common/safe-HTS/SafeHTS.sol";

abstract contract OrderBookHTS {
    address public tokenA;
    address public tokenB;
    mapping(uint256 => Order) public buyOrders;
    mapping(uint256 => Order) public sellOrders;
    mapping(address => mapping(address => int64)) public balanceOf;
    uint256 public firstBuyOrderId;
    uint256 public firstSellOrderId;
    uint256 public currentOrderId;

    event Trade(int64 tradedVolume, int64 price, address buyer, address seller);
    event NewOrder(bool isBuy, uint256 orderId, address trader, int64 price, int64 volume);
    event Deposit(address indexed trader, address token, int64 amount);
    event Withdraw(address trader, address token, int64 amount);
    event OrderCanceled(bool isBuy, uint256 indexed orderId, address indexed trader);

    struct Order {
        uint256 id;
        int64 price;
        int64 volume;
        address trader;
        uint256 next;
    }

    function _insertBuyOrder(address trader, int64 price, int64 volume) internal {
        currentOrderId++;  // Increment order ID for the next order
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

        balanceOf[trader][tokenB] -= price * (volume / 10 ** 8);
        emit NewOrder(true, currentOrderId, trader, price, volume);

        if (lastId == 0) {
            firstBuyOrderId = currentOrderId;
        } else {
            buyOrders[lastId].next = currentOrderId;
        }

    }

    function _insertSellOrder(address trader, int64 price, int64 volume) internal {
        currentOrderId++;  // Increment order ID for the next order
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
        int64 sellPrice,
        int64 sellVolume
    ) internal returns (int64) {
        uint256 currentBuyId = firstBuyOrderId;

        while (currentBuyId != 0 && sellVolume > 0) {
            Order storage buyOrder = buyOrders[currentBuyId];

            if (sellPrice <= buyOrder.price) {
                int64 tradedVolume = (buyOrder.volume < sellVolume) ? buyOrder.volume : sellVolume;
                int64 tradedPrice = sellPrice;

                balanceOf[sellTrader][tokenB] += tradedPrice * (tradedVolume / 10 ** 8);
                balanceOf[sellTrader][tokenA] -= tradedVolume;
                balanceOf[buyOrder.trader][tokenA] += tradedVolume;

                sellVolume -= tradedVolume;
                buyOrder.volume -= tradedVolume;

                emit Trade(tradedVolume, buyOrder.price, sellTrader, buyOrder.trader);

                if (buyOrder.volume == 0) {
                    uint256 nextId = buyOrder.next;
                    delete buyOrders[currentBuyId];  // Remove the order after it is fully matched
                    currentBuyId = nextId;
                }
            } else {
                break;
            }
        }

        firstBuyOrderId = currentBuyId;  // Update the first buy order ID
        return sellVolume;
    }

    function _matchSellOrders(
        address buyTrader,
        int64 buyPrice,
        int64 buyVolume
    ) internal returns (int64) {
        uint256 currentSellId = firstSellOrderId;

        while (currentSellId != 0 && buyVolume > 0) {
            Order storage sellOrder = sellOrders[currentSellId];

            if (buyPrice >= sellOrder.price) {
                int64 tradedVolume = (sellOrder.volume < buyVolume) ? sellOrder.volume : buyVolume;
                int64 tradedPrice = sellOrder.price;

                balanceOf[buyTrader][tokenB] -= tradedPrice * (tradedVolume / 10 ** 8);
                balanceOf[buyTrader][tokenA] += tradedVolume;
                balanceOf[sellOrder.trader][tokenB] += tradedPrice * (tradedVolume / 10 ** 8);

                buyVolume -= tradedVolume;
                sellOrder.volume -= tradedVolume;

                emit Trade(tradedVolume, sellOrder.price, buyTrader, sellOrder.trader);

                if (sellOrder.volume == 0) {
                    uint256 nextId = sellOrder.next;
                    delete sellOrders[currentSellId];  // Remove the order after it is fully matched
                    currentSellId = nextId;
                }
            } else {
                break;
            }
        }

        firstSellOrderId = currentSellId;  // Update the first sell order ID
        return buyVolume;
    }

    function _deposit(address trader, address token, int64 amount) internal {
        SafeHTS.safeTransferToken(token, trader, address(this), amount);
        balanceOf[trader][token] += amount;
        emit Deposit(trader, token, amount);
    }

    function _withdraw(address trader, address token, int64 amount) internal {
        balanceOf[trader][token] -= amount;
        SafeHTS.safeTransferToken(token, address(this), trader, amount);
        emit Withdraw(trader, token, amount);
    }

    function _cancelSellOrder(Order storage sellOrder) internal {
        if (sellOrder.id == firstSellOrderId) {
            firstSellOrderId = sellOrder.next;
        } else {
            Order storage currentOrder = sellOrders[firstSellOrderId];

            while (currentOrder.next != sellOrder.id) {
                require(currentOrder.next != 0, "Order not found");
                currentOrder = sellOrders[currentOrder.next];
            }
            currentOrder.next = sellOrder.next;
        }

        balanceOf[sellOrder.trader][tokenA] += sellOrder.volume;
        sellOrder.volume = 0;

        emit OrderCanceled(false, sellOrder.id, msg.sender);
    }

    function _cancelBuyOrder(Order storage buyOrder) internal {
        if (buyOrder.id == firstBuyOrderId) {
            firstBuyOrderId = buyOrder.next;
        } else {
            Order storage currentOrder = buyOrders[firstBuyOrderId];

            while (currentOrder.next != buyOrder.id) {
                require(currentOrder.next != 0, "Order not found");
                currentOrder = buyOrders[currentOrder.next];
            }
            currentOrder.next = buyOrder.next;
        }

        balanceOf[buyOrder.trader][tokenB] += buyOrder.price * (buyOrder.volume / 10 ** 8);
        buyOrder.volume = 0;

        emit OrderCanceled(true, buyOrder.id, msg.sender);
    }
}
