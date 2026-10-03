// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Append-only confession/praise records for holders of >= 1 whole token.
/// No fee, token transfer, approval, burn, owner, upgrade, edit or delete.
/// Payload bytes remain publicly accessible; encryption is the client's job.
contract HolderFaithRecords {
    uint256 public constant MAX_PAYLOAD_BYTES = 16384;
    address public immutable godToken;
    uint8 public immutable tokenDecimals;
    uint256 public immutable minimumHolding;
    struct Record { address author; uint256 createdAt; uint8 kind; bytes payload; }
    mapping(bytes32 => Record) private records;
    event FaithRecorded(bytes32 indexed recordId, address indexed author, uint8 kind, bytes32 payloadHash);
    error InvalidToken();
    error TokenReadFailed();
    error TokenPrecisionChanged();
    error InsufficientHolding();
    error InvalidKind();
    error InvalidPayload();
    error AlreadyRecorded();

    constructor(address token, uint8 expectedDecimals) {
        if (token.code.length == 0 || expectedDecimals > 36) revert InvalidToken();
        if (readUint(token, abi.encodeWithSelector(bytes4(0x313ce567))) != expectedDecimals) revert InvalidToken();
        // A decimals method alone is not evidence that balanceOf is supported.
        readUint(token, abi.encodeWithSelector(bytes4(0x70a08231), address(this)));
        godToken = token;
        tokenDecimals = expectedDecimals;
        minimumHolding = 10 ** uint256(expectedDecimals);
    }

    /// @dev Exactly one ABI word; bounded STATICCALL cannot mutate token state.
    /// Return copying is capped, including for hostile/oversized token responses.
    function readUint(address token, bytes memory input) private view returns (uint256 result) {
        bool ok;
        uint256 size;
        assembly ("memory-safe") {
            let output := mload(0x40)
            ok := staticcall(50000, token, add(input, 32), mload(input), output, 32)
            size := returndatasize()
            result := mload(output)
        }
        if (!ok || size != 32) revert TokenReadFailed();
    }

    /// @param kind 1 = confession, 2 = praise. Prayer uses the separate open contract.
    function recordFaith(uint8 kind, bytes calldata payload) external returns (bytes32 recordId) {
        if (kind != 1 && kind != 2) revert InvalidKind();
        if (payload.length == 0 || payload.length > MAX_PAYLOAD_BYTES) revert InvalidPayload();
        bytes32 payloadHash = keccak256(payload);
        recordId = keccak256(abi.encode(block.chainid, address(this), msg.sender, kind, payloadHash));
        if (records[recordId].author != address(0)) revert AlreadyRecorded();
        if (readUint(godToken, abi.encodeWithSelector(bytes4(0x313ce567))) != tokenDecimals) revert TokenPrecisionChanged();
        if (readUint(godToken, abi.encodeWithSelector(bytes4(0x70a08231), msg.sender)) < minimumHolding) revert InsufficientHolding();
        records[recordId] = Record(msg.sender, block.timestamp, kind, payload);
        emit FaithRecorded(recordId, msg.sender, kind, payloadHash);
    }

    // Reading a prior record never depends on its author's current balance.
    function readFaith(bytes32 recordId) external view returns (address author, uint256 createdAt, uint8 kind, bytes memory payload) {
        Record storage item = records[recordId];
        return (item.author, item.createdAt, item.kind, item.payload);
    }
}
