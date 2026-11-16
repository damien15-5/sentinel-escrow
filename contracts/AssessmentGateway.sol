// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;
import {FeePayer} from "./Omni.sol";
import {EscrowVault} from "./EscrowVault.sol";

/// @notice Separate callback gas budget and single authorized AI reporter.
contract AssessmentGateway is FeePayer {
    address public immutable reactive;
    address public immutable reporter;
    bytes32 public immutable modelHash;
    EscrowVault public immutable vault;
    struct Job { bytes32 contentHash; uint64 deadline; bool reported; uint16 score; bytes32 reportHash; }
    mapping(uint256 => Job) public jobs;
    event AssessmentRequested(uint256 indexed id, bytes32 indexed contentHash, uint64 deadline);
    event RiskReported(uint256 indexed id, bytes32 indexed contentHash, uint16 score, bytes32 reportHash, bytes32 modelHash);
    event DecisionDelivered(uint256 indexed id, uint16 score, bool frozen);
    error InvalidJob();
    error Expired();
    constructor(address proxy, address reactive_, address reporter_, address vault_, bytes32 modelHash_) payable FeePayer(proxy) {
        require(reactive_ != address(0) && reporter_ != address(0) && vault_.code.length > 0 && modelHash_ != bytes32(0), "invalid config");
        reactive = reactive_; reporter = reporter_; vault = EscrowVault(vault_); modelHash = modelHash_;
    }
    modifier authentic(address sender) {
        if (sender != reactive) revert Unauthorized();
        _;
    }
    function requestAssessment(address sender, uint256 id, bytes32 hash, uint64 deadline) external onlyService authentic(sender) {
        (,,,uint64 actualDeadline,EscrowVault.State state,,bytes32 actualHash,) = vault.escrows(id);
        if (state == EscrowVault.State.Missing || hash != actualHash || deadline != actualDeadline) revert InvalidJob();
        if (jobs[id].contentHash != bytes32(0) || block.timestamp >= deadline || state != EscrowVault.State.Pending) return;
        jobs[id] = Job(hash, deadline, false, 0, bytes32(0));
        emit AssessmentRequested(id, hash, deadline);
    }
    function reportRisk(uint256 id, uint16 score, bytes32 reportHash) external {
        if (msg.sender != reporter) revert Unauthorized();
        Job storage job = jobs[id];
        if (job.contentHash == bytes32(0) || job.reported || score > 10000 || reportHash == bytes32(0)) revert InvalidJob();
        if (block.timestamp >= job.deadline) revert Expired();
        job.reported = true; job.score = score; job.reportHash = reportHash;
        emit RiskReported(id, job.contentHash, score, reportHash, modelHash);
    }
    function deliverDecision(address sender, uint256 id, bytes32 hash, uint16 score, bool frozen, bytes32 reportHash) external onlyService authentic(sender) {
        Job storage job = jobs[id];
        if (!job.reported || hash != job.contentHash || score != job.score || reportHash != job.reportHash) revert InvalidJob();
        vault.applyAssessment(id, hash, score, frozen, reportHash);
        emit DecisionDelivered(id, score, frozen);
    }
}
