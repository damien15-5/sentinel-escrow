// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;
import {IOmni, IReactive, FeePayer} from "./Omni.sol";

/// @notice Omni-native two-stage policy engine. No legacy RVM or Callback event API.
contract SentinelReactive is IReactive, FeePayer {
    address public constant SYSTEM = 0x8888888888888888888888888888888888888888;
    uint256 private constant IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;
    uint256 public constant OPEN_TOPIC = uint256(keccak256("EscrowOpened(uint256,bytes32,address,address,uint256,uint64,string)"));
    uint256 public constant REPORT_TOPIC = uint256(keccak256("RiskReported(uint256,bytes32,uint16,bytes32,bytes32)"));
    address public immutable owner;
    uint256 public immutable originChain;
    uint16 public immutable threshold;
    bytes32 public immutable modelHash;
    address public vault;
    address public gateway;
    struct Request { bytes32 hash; uint64 deadline; uint64 lastRetry; bool decided; uint16 score; bytes32 reportHash; }
    mapping(uint256 => Request) public requests;
    event AssessmentRouted(uint256 indexed id, bytes32 originTxHash, bytes32 contentHash);
    event DecisionRouted(uint256 indexed id, bytes32 reportTxHash, uint16 score, bool frozen, bytes32 reportHash);
    event DeliveryRetried(uint256 indexed id, bool decision);
    event Configured(address vault, address gateway);
    error InvalidConfig();
    error InvalidEvent();
    error RetryUnavailable();
    constructor(uint256 originChain_, uint16 threshold_, bytes32 modelHash_) payable FeePayer(SYSTEM) {
        require(originChain_ != 0 && threshold_ > 0 && threshold_ <= 10000 && modelHash_ != bytes32(0), "invalid policy");
        owner = msg.sender; originChain = originChain_; threshold = threshold_; modelHash = modelHash_;
    }
    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
    /// @dev One-time wiring; subscriptions are exact chain + contract + topic matches.
    function configure(address vault_, address gateway_) external onlyOwner {
        if (vault != address(0) || vault_ == address(0) || gateway_ == address(0)) revert InvalidConfig();
        vault = vault_; gateway = gateway_;
        IOmni(SYSTEM).subscribe(originChain, vault_, OPEN_TOPIC, IGNORE, IGNORE, IGNORE);
        IOmni(SYSTEM).subscribe(originChain, gateway_, REPORT_TOPIC, IGNORE, IGNORE, IGNORE);
        emit Configured(vault_, gateway_);
    }
    function react(LogRecord calldata log_) external onlyService {
        if (vault == address(0) || log_.chainId != originChain || log_.opCode != 3) revert InvalidEvent();
        uint256 id = log_.topic1;
        bytes32 hash = bytes32(log_.topic2);
        if (log_.contractAddress == vault && log_.topic0 == OPEN_TOPIC) {
            if (requests[id].hash != bytes32(0)) return;
            (,,,uint64 deadline,) = abi.decode(log_.data, (address,address,uint256,uint64,string));
            if (hash == bytes32(0) || id == 0) revert InvalidEvent();
            if (block.timestamp >= deadline) return;
            requests[id] = Request(hash, deadline, uint64(block.timestamp), false, 0, bytes32(0));
            _request(id);
            emit AssessmentRouted(id, bytes32(log_.txHash), hash);
        } else if (log_.contractAddress == gateway && log_.topic0 == REPORT_TOPIC) {
            Request storage request = requests[id];
            (uint16 score, bytes32 reportHash, bytes32 model) = abi.decode(log_.data, (uint16,bytes32,bytes32));
            if (request.hash == bytes32(0) || request.hash != hash || score > 10000 || model != modelHash || reportHash == bytes32(0)) revert InvalidEvent();
            if (request.decided || block.timestamp >= request.deadline) return;
            request.decided = true; request.score = score; request.reportHash = reportHash;
            _decide(id);
            emit DecisionRouted(id, bytes32(log_.txHash), score, score >= threshold, reportHash);
        } else revert InvalidEvent();
    }
    /// @notice Retries only the existing, immutable request/result; cannot override a score.
    function retryDelivery(uint256 id) external onlyOwner {
        Request storage request = requests[id];
        if (request.hash == bytes32(0) || block.timestamp >= request.deadline || block.timestamp < request.lastRetry + 30) revert RetryUnavailable();
        request.lastRetry = uint64(block.timestamp);
        if (request.decided) _decide(id); else _request(id);
        emit DeliveryRetried(id, request.decided);
    }
    function _request(uint256 id) private {
        Request storage request = requests[id];
        _callback(abi.encodeWithSignature("requestAssessment(address,uint256,bytes32,uint64)", address(0), id, request.hash, request.deadline));
    }
    function _decide(uint256 id) private {
        Request storage request = requests[id];
        _callback(abi.encodeWithSignature("deliverDecision(address,uint256,bytes32,uint16,bool,bytes32)", address(0), id, request.hash, request.score, request.score >= threshold, request.reportHash));
    }
    function _callback(bytes memory payload) private {
        IOmni(SYSTEM).requestCallbackV_1_0(IOmni.CallbackConfiguration_V_1_0(originChain, gateway, 600000, payload));
    }
}
