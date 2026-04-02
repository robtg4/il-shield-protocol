// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title BrevisCallback
/// @notice Brevis zkCoprocessor integration for historical data verification
/// @dev Receives ZK-proven historical sqrtPriceX96 values for IL computation at settlement
///      when hook accumulator data is unavailable (positions predating hook deployment)
contract BrevisCallback is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");

    /// @notice Verified historical price data: poolId => blockNumber => sqrtPriceX96
    mapping(bytes32 => mapping(uint256 => uint160)) public verifiedPrices;

    /// @notice Whether a price has been verified for a pool at a block
    mapping(bytes32 => mapping(uint256 => bool)) public isVerified;

    /// @notice Accepted verification key hashes for Brevis circuits
    mapping(bytes32 => bool) public acceptedVkHashes;

    /// @notice Pending proof requests
    struct ProofRequest {
        bytes32 poolId;
        uint256 blockNumber;
        address requester;
        uint48 requestBlock;
        bool fulfilled;
    }
    mapping(bytes32 => ProofRequest) public proofRequests;
    uint256 public nextRequestId;

    error InvalidVkHash();
    error AlreadyVerified();
    error RequestNotFound();
    error InvalidProofOutput();
    error NotFulfilled();

    event VkHashRegistered(bytes32 indexed vkHash);
    event VkHashRemoved(bytes32 indexed vkHash);
    event ProofRequested(bytes32 indexed requestId, bytes32 indexed poolId, uint256 blockNumber, address requester);
    event ProofVerified(bytes32 indexed requestId, bytes32 indexed poolId, uint256 blockNumber, uint160 sqrtPriceX96);
    event PriceVerified(bytes32 indexed poolId, uint256 blockNumber, uint160 sqrtPriceX96);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── VK Hash Management ─────────────────────────────────────────────

    /// @notice Register an accepted verification key hash for Brevis circuits
    /// @param vkHash The verification key hash
    function registerVkHash(bytes32 vkHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        acceptedVkHashes[vkHash] = true;
        emit VkHashRegistered(vkHash);
    }

    /// @notice Remove a verification key hash
    /// @param vkHash The verification key hash to remove
    function removeVkHash(bytes32 vkHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        acceptedVkHashes[vkHash] = false;
        emit VkHashRemoved(vkHash);
    }

    // ─── Proof Requests ─────────────────────────────────────────────────

    /// @notice Request a ZK proof for historical price data
    /// @param poolId The pool identifier
    /// @param blockNumber The historical block to prove
    /// @return requestId The proof request identifier
    function requestProof(bytes32 poolId, uint256 blockNumber) external returns (bytes32 requestId) {
        requestId = keccak256(abi.encodePacked(poolId, blockNumber, nextRequestId++));

        proofRequests[requestId] = ProofRequest({
            poolId: poolId,
            blockNumber: blockNumber,
            requester: msg.sender,
            requestBlock: uint48(block.number),
            fulfilled: false
        });

        emit ProofRequested(requestId, poolId, blockNumber, msg.sender);
    }

    // ─── Brevis Callback ────────────────────────────────────────────────

    /// @notice Callback from Brevis after ZK proof verification
    /// @dev Called by the Brevis verification contract after proof is verified
    /// @param vkHash The verification key hash of the circuit
    /// @param circuitOutput The proven output data (abi-encoded: poolId, blockNumber, sqrtPriceX96)
    function handleProofResult(bytes32 vkHash, bytes calldata circuitOutput) external onlyRole(VERIFIER_ROLE) {
        if (!acceptedVkHashes[vkHash]) revert InvalidVkHash();

        // Decode the proven output
        (bytes32 poolId, uint256 blockNumber, uint160 sqrtPriceX96) =
            abi.decode(circuitOutput, (bytes32, uint256, uint160));

        if (sqrtPriceX96 == 0) revert InvalidProofOutput();

        // Store the verified price
        verifiedPrices[poolId][blockNumber] = sqrtPriceX96;
        isVerified[poolId][blockNumber] = true;

        emit PriceVerified(poolId, blockNumber, sqrtPriceX96);
    }

    /// @notice Fulfill a pending proof request
    /// @param requestId The proof request to fulfill
    /// @param vkHash The verification key hash
    /// @param circuitOutput The proven output data
    function fulfillProofRequest(bytes32 requestId, bytes32 vkHash, bytes calldata circuitOutput)
        external
        onlyRole(VERIFIER_ROLE)
    {
        ProofRequest storage request = proofRequests[requestId];
        if (request.requester == address(0)) revert RequestNotFound();
        if (!acceptedVkHashes[vkHash]) revert InvalidVkHash();

        (bytes32 poolId, uint256 blockNumber, uint160 sqrtPriceX96) =
            abi.decode(circuitOutput, (bytes32, uint256, uint160));

        if (poolId != request.poolId || blockNumber != request.blockNumber) revert InvalidProofOutput();
        if (sqrtPriceX96 == 0) revert InvalidProofOutput();

        verifiedPrices[poolId][blockNumber] = sqrtPriceX96;
        isVerified[poolId][blockNumber] = true;
        request.fulfilled = true;

        emit ProofVerified(requestId, poolId, blockNumber, sqrtPriceX96);
    }

    // ─── Queries ────────────────────────────────────────────────────────

    /// @notice Get a verified historical price
    /// @param poolId The pool identifier
    /// @param blockNumber The block to query
    /// @return sqrtPriceX96 The verified sqrt price
    function getVerifiedPrice(bytes32 poolId, uint256 blockNumber) external view returns (uint160) {
        if (!isVerified[poolId][blockNumber]) revert NotFulfilled();
        return verifiedPrices[poolId][blockNumber];
    }

    /// @notice Check if a price has been verified
    /// @param poolId The pool identifier
    /// @param blockNumber The block to check
    /// @return Whether the price is verified
    function isPriceVerified(bytes32 poolId, uint256 blockNumber) external view returns (bool) {
        return isVerified[poolId][blockNumber];
    }
}
