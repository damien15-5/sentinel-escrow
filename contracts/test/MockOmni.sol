// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;
import {IOmni, IReactive} from "../Omni.sol";
import {EscrowVault} from "../EscrowVault.sol";

/// @dev Local test transport ONLY. No real validators, finality, billing or network latency.
contract MockOmni {
    event CallbackRequested(address indexed reactive, uint256 chainId, address recipient, uint64 gasLimit, bytes payload);
    event Subscribed(address indexed reactive, uint256 chainId, address source, uint256 topic);
    function subscribe(uint256 chainId, address source, uint256 topic, uint256, uint256, uint256) external {
        emit Subscribed(msg.sender, chainId, source, topic);
    }
    function requestCallbackV_1_0(IOmni.CallbackConfiguration_V_1_0 memory config) external {
        emit CallbackRequested(msg.sender, config.chainId, config.recipient, config.gasLimit, config.payload);
    }
    function trigger(address target, IReactive.LogRecord calldata record) external { IReactive(target).react(record); }
    function debt(address) external pure returns (uint256) { return 0; }
    function charge(address target, uint256 amount) external {
        (bool ok,) = target.call(abi.encodeWithSignature("pay(uint256)", amount)); require(ok, "charge failed");
    }
    receive() external payable {}
}
contract MockCallbackProxy {
    function deliver(address reactive, address target, bytes memory payload) external {
        // First ABI argument after the selector is replaced with the authenticated sender.
        assembly { mstore(add(payload, 36), reactive) }
        (bool ok, bytes memory result) = target.call(payload);
        if (!ok) assembly { revert(add(result, 32), mload(result)) }
    }
    function debt(address) external pure returns (uint256) { return 0; }
    function charge(address target, uint256 amount) external {
        (bool ok,) = target.call(abi.encodeWithSignature("pay(uint256)", amount)); require(ok, "charge failed");
    }
    receive() external payable {}
}

contract ReentrantBuyer {
    EscrowVault public immutable vault;
    uint256 public id;
    bool public reentrySucceeded;
    constructor(address vault_) { vault = EscrowVault(vault_); }
    function open(address seller, string calldata listing) external payable {
        id = vault.open{value:msg.value}(seller,3600,listing);
    }
    function refund() external { vault.refund(id); }
    receive() external payable {
        (reentrySucceeded,) = address(vault).call(abi.encodeWithSignature("refund(uint256)",id));
    }
}
