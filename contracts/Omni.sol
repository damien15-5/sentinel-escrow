// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

// ABI compatibility declarations, independently implemented against the Omni docs.
// Reference: Reactive-Network/reactive-lib-omni @ 3ade0dcf1d27e67e5783ef807e73a1b9e0c0cce8.
interface IOmni {
    struct CallbackConfiguration_V_1_0 { uint256 chainId; address recipient; uint64 gasLimit; bytes payload; }
    function subscribe(uint256, address, uint256, uint256, uint256, uint256) external;
    function requestCallbackV_1_0(CallbackConfiguration_V_1_0 memory config) external;
    function debt(address target) external view returns (uint256);
}

interface IReactive {
    struct LogRecord {
        uint256 chainId; address contractAddress;
        uint256 topic0; uint256 topic1; uint256 topic2; uint256 topic3;
        bytes data; uint256 blockNumber; uint256 opCode;
        uint256 blockHash; uint256 txHash; uint256 logIndex;
    }
    function react(LogRecord calldata record) external;
}

/// @dev Only fee-paying components inherit this. Never used by the deposit vault.
abstract contract FeePayer {
    address public immutable serviceProvider;
    error Unauthorized();
    error PaymentFailed();
    constructor(address provider) {
        require(provider != address(0), "zero provider");
        serviceProvider = provider;
    }
    modifier onlyService() { if (msg.sender != serviceProvider) revert Unauthorized(); _; }
    receive() external payable {}
    function pay(uint256 amount) external onlyService { _pay(amount); }
    function coverDebt() external { _pay(IOmni(serviceProvider).debt(address(this))); }
    function _pay(uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = payable(serviceProvider).call{value: amount}("");
        if (!ok) revert PaymentFailed();
    }
}
