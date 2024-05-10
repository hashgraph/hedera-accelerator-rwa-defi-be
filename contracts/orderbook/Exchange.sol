// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

abstract contract OrderBook {
    address public tokenA;
    address public tokenB;
    mapping(uint => Order) public buyOrders;
    mapping(uint => Order) public sellOrders;

    mapping(address => mapping(address => uint)) public balanceOf;

    event Trade(uint tradedVolume, uint price, address indexed buyer, address seller);
    event NewOrder(bool isBuy, Order order);
    event Deposit(address indexed trader, address token, uint amount);
    event Withdraw(address indexed trader, address token, uint amount);
    event OrderCanceled(bool isBuy, uint indexed orderId, address indexed trader);

    struct Order {
        uint id;
        uint price;
        uint volume;
        address trader;
        uint next;
    }

    function _insertBuyOrder(uint firstOrderId, uint price, uint volume, address trader, uint lastOrderId) internal returns (uint) {
        uint currentId = firstOrderId;
        uint lastId = 0;

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

    function _insertSellOrder(uint firstOrderId, uint price, uint volume, address trader, uint lastOrderId) internal returns (uint) {
        uint currentId = firstOrderId;
        uint lastId = 0;

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
        uint firstBuyOrderId,
        address sellTrader,
        uint sellPrice,
        uint sellVolume
    ) internal returns (uint)  {
        uint currentBuyId = buyOrders[firstBuyOrderId].id; 

        while (currentBuyId != 0 && sellVolume > 0) {
            Order storage buyOrder = buyOrders[currentBuyId];

            if (sellPrice <= buyOrder.price) {
                uint tradedVolume = (buyOrder.volume < sellVolume) ? buyOrder.volume : sellVolume;
                uint tradedPrice = sellPrice;

                // trade
                // (bool overflown, uint balanceTokenB) = Math.tryMul(tradedPrice, tradedVolume);
                // require(overflown, "mul overflow");

                // balanceOf[buyOrder.trader][tokenB] -= tradedPrice * tradedVolume;
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
        uint firstSellOrderId,
        address buyTrader,
        uint buyPrice,
        uint buyVolume
    ) internal returns (uint) {
        uint currentSellId = sellOrders[firstSellOrderId].id; 

        while (currentSellId != 0 && buyVolume > 0) {
            Order storage sellOrder = sellOrders[currentSellId];

            if (buyPrice >= sellOrder.price) {
                uint tradedVolume = (sellOrder.volume < buyVolume) ? sellOrder.volume : buyVolume;
                uint tradedPrice = sellOrder.price;


                // trade
                // balanceOf[sellOrder.trader][tokenA] -= tradedVolume;
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

    function _deposit(address trader, address token, uint amount) internal {
        IERC20(token).transferFrom(trader, address(this), amount);
        balanceOf[trader][token] += amount;
        emit Deposit(trader, token, amount);
    }

    function _withdraw(address trader, address token, uint amount) internal {
        balanceOf[trader][token] -= amount;
        IERC20(token).transfer(trader, amount);
        emit Withdraw(trader, token, amount);
    }

    function _cancelSellOrder(Order storage sellOrder, uint firstSellOrderId) internal {        
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
}

contract Exchange is OrderBook {
    uint public firstBuyOrderId;
    uint public firstSellOrderId;
    uint public lastOrderId;

    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function placeBuyOrder(uint price, uint volume) public {
        require(price > 0, "Invalid Price");
        require(volume > 0, "Invalid Volume");
        require(balanceOf[msg.sender][tokenB] >= price * volume, "Not enough balance");

        lastOrderId++;

        (uint remainVolume) = _matchSellOrders(firstSellOrderId, msg.sender, price, volume);

        if (remainVolume > 0) {
            uint newFirstBuyOrderId = _insertBuyOrder(firstBuyOrderId, price, remainVolume, msg.sender, lastOrderId);

            if (newFirstBuyOrderId != firstBuyOrderId) {
                firstBuyOrderId = newFirstBuyOrderId;
            }
        }
    }

    function placeSellOrder(uint price, uint volume) public {
        require(price > 0, "Invalid Price");
        require(volume > 0, "Invalid Volume");
        require(balanceOf[msg.sender][tokenA] >= volume, "Not enough balance");

        lastOrderId++;

        (uint remainVolume) = _matchBuyOrders(firstBuyOrderId, msg.sender, price, volume);

        if (remainVolume > 0){
            uint newFirstSellOrderId = _insertSellOrder(firstSellOrderId, price, remainVolume, msg.sender, lastOrderId);
            
            if (newFirstSellOrderId != firstSellOrderId) {
                firstSellOrderId = newFirstSellOrderId;
            }
        }        
    }

    function deposit(address token, uint amount) public {
        require(token == tokenA || token == tokenB, "Invalid token");
        require(amount > 0, "Invalid amount");

        _deposit(msg.sender, token, amount);
    }

    function withdraw(address token, uint amount) public {
        require(token == tokenA || token == tokenB, "Invalid token");
        require(amount > 0, "Invalid amount");
        require(balanceOf[msg.sender][token] >= amount, "Not enough balance");
     
        _withdraw(msg.sender, token, amount);
    }

    function cancelSellOrder(uint orderId) public {
        Order storage sellOrder = sellOrders[orderId];

        require(sellOrder.trader != address(0), "Order do not exists" );
        require(sellOrder.trader == msg.sender, "Only the order creator can cancel this order");
        require(sellOrder.volume > 0, "Order already cancelled or fulfilled");

        _cancelSellOrder(sellOrder, firstSellOrderId);
    }
}
