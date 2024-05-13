// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Orderbook.sol";

contract Exchange is OrderBook {    
    /**
     * .contructor
     * @dev Exchange constructor
     * @param _tokenA address of token A
     * @param _tokenB address of token B
     */
    constructor(address _tokenA, address _tokenB) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    /**
     * .placeBuyOrder
     * @dev match buy order with existing sell oreders, the remaining volume is created as a buy order
     * @param price bid price in tokenB
     * @param volume bid amount in token A
     */
    function placeBuyOrder(uint256 price, uint256 volume) public {
        require(price > 0, "Invalid Price");
        require(volume > 0, "Invalid Volume");
        require(balanceOf[msg.sender][tokenB] >= price * volume, "Not enough balance");

        lastOrderId++;

        (uint256 remainVolume) = _matchSellOrders(msg.sender, price, volume);

        if (remainVolume > 0) {
            _insertBuyOrder(price, remainVolume, msg.sender);
        }
    }

     /**
     * .placeSellOrder
     * @dev match sell order with existing buy oreders, the remaining volume is created as a sell order
     * @param price ask price in tokenB
     * @param volume ask amount in token A
     */
    function placeSellOrder(uint256 price, uint256 volume) public {
        require(price > 0, "Invalid Price");
        require(volume > 0, "Invalid Volume");
        require(balanceOf[msg.sender][tokenA] >= volume, "Not enough balance");

        lastOrderId++;

        (uint256 remainVolume) = _matchBuyOrders(msg.sender, price, volume);

        if (remainVolume > 0){
            _insertSellOrder(price, remainVolume, msg.sender);
        }        
    }

    /**
     * .deposit
     * @dev make an ERC20 from deposit from the sender to this contract given the token and amount
     * @param token address of the ERC20 token to deposit
     * @param amount total value of the deposit
     * @notice it's mandatory to perform an approve call before calling this function.
     */
    function deposit(address token, uint256 amount) public {
        require(token == tokenA || token == tokenB, "Invalid token");
        require(amount > 0, "Invalid amount");

        _deposit(msg.sender, token, amount);
    }

    /**
     * .withdraw
     * @dev make an ERC20 withdraw from this contract to the sender given the token and amount
     * @param token address of the ERC20 token to withdraw
     * @param amount total value of the withdraw
     */
    function withdraw(address token, uint256 amount) public {
        require(token == tokenA || token == tokenB, "Invalid token");
        require(amount > 0, "Invalid amount");
        require(balanceOf[msg.sender][token] >= amount, "Not enough balance");
     
        _withdraw(msg.sender, token, amount);
    }

    /**
     * .cancelOrder
     * @dev cancel an order by id
     * @param orderId uint256 id of the order
     * @param isBuyOrder boolean flag wheter the order is buy or sell
     * @notice only creator of the order can call this function
     */
    function cancelOrder(uint256 orderId, bool isBuyOrder) public {
        Order storage order = isBuyOrder ? buyOrders[orderId] : sellOrders[orderId];

        require(order.trader != address(0), "Order do not exists" );
        require(order.trader == msg.sender, "Only the order creator can cancel this order");
        require(order.volume > 0, "Order already cancelled or fulfilled");

        isBuyOrder 
            ? _cancelBuyOrder(order)
            : _cancelSellOrder(order);
    }
}
