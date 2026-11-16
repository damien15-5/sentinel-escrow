// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

/// @notice Buyer-controlled ETH escrow. AI clearance is necessary, never sufficient, for release.
/// @dev No fee-payment interface: deposits cannot pay Reactive's service bills.
contract EscrowVault {
    enum State { Missing, Pending, Cleared, Frozen, Released, Refunded }
    struct Escrow {
        address buyer; address seller; uint256 amount;
        uint64 deadline; State state; uint16 score;
        bytes32 contentHash; bytes32 reportHash;
    }
    address public immutable owner;
    address public gateway;
    uint256 public nextId = 1;
    uint256 public totalLocked;
    mapping(uint256 => Escrow) public escrows;
    error Unauthorized();
    error InvalidInput();
    error InvalidState();
    error TooEarly();
    error TransferFailed();
    event EscrowOpened(uint256 indexed id, bytes32 indexed contentHash, address buyer, address seller, uint256 amount, uint64 deadline, string listing);
    event AssessmentApplied(uint256 indexed id, uint16 score, bool frozen, bytes32 reportHash);
    event Released(uint256 indexed id, address seller, uint256 amount);
    event Refunded(uint256 indexed id, address buyer, uint256 amount);
    event GatewayConfigured(address gateway);

    constructor() { owner = msg.sender; }
    function configureGateway(address target) external {
        if (msg.sender != owner) revert Unauthorized();
        if (gateway != address(0) || target.code.length == 0) revert InvalidInput();
        gateway = target;
        emit GatewayConfigured(target);
    }
    function open(address seller, uint64 duration, string calldata listing) external payable returns (uint256 id) {
        if (gateway == address(0) || seller == address(0) || seller == msg.sender || msg.value == 0 ||
            duration < 60 || duration > 30 days || bytes(listing).length == 0 || bytes(listing).length > 2048) revert InvalidInput();
        id = nextId++;
        bytes32 hash = keccak256(bytes(listing));
        uint64 deadline = uint64(block.timestamp) + duration;
        escrows[id] = Escrow(msg.sender, seller, msg.value, deadline, State.Pending, 0, hash, bytes32(0));
        totalLocked += msg.value;
        emit EscrowOpened(id, hash, msg.sender, seller, msg.value, deadline, listing);
    }
    function applyAssessment(uint256 id, bytes32 contentHash, uint16 score, bool frozen, bytes32 reportHash) external {
        if (msg.sender != gateway) revert Unauthorized();
        Escrow storage item = escrows[id];
        if (item.state == State.Missing || item.contentHash != contentHash || score > 10000 || reportHash == bytes32(0)) revert InvalidInput();
        // Delayed and duplicate callbacks cannot reopen a finalized or refunded escrow.
        if (item.state != State.Pending || block.timestamp >= item.deadline) return;
        item.score = score;
        item.reportHash = reportHash;
        item.state = frozen ? State.Frozen : State.Cleared;
        emit AssessmentApplied(id, score, frozen, reportHash);
    }
    function release(uint256 id) external {
        Escrow storage item = escrows[id];
        if (msg.sender != item.buyer) revert Unauthorized();
        if (item.state != State.Cleared || block.timestamp >= item.deadline) revert InvalidState();
        item.state = State.Released;
        totalLocked -= item.amount;
        _transfer(item.seller, item.amount);
        emit Released(id, item.seller, item.amount);
    }
    function refund(uint256 id) external {
        Escrow storage item = escrows[id];
        if (msg.sender != item.buyer) revert Unauthorized();
        if (item.state != State.Pending && item.state != State.Cleared && item.state != State.Frozen) revert InvalidState();
        if (item.state != State.Frozen && block.timestamp < item.deadline) revert TooEarly();
        item.state = State.Refunded;
        totalLocked -= item.amount;
        _transfer(item.buyer, item.amount);
        emit Refunded(id, item.buyer, item.amount);
    }
    function _transfer(address to, uint256 amount) private {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
