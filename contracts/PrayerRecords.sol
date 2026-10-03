// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// @notice Gas-only append-only prayer storage. No token, owner, upgrade,
/// withdrawal, edit or delete methods. Bytes are PUBLIC, even when encrypted.
/// The JSON envelope is validated by clients, not religiously authenticated.
contract PrayerRecords {
    uint256 public constant MAX_PAYLOAD_BYTES = 16384;
    struct Record { address author; uint256 createdAt; bytes payload; }
    mapping(bytes32 => Record) private records;
    event PrayerRecorded(bytes32 indexed recordId, address indexed author, bytes32 payloadHash);
    error InvalidPayload();
    error AlreadyRecorded();

    function recordPrayer(bytes calldata payload) external returns (bytes32 recordId) {
        if (payload.length == 0 || payload.length > MAX_PAYLOAD_BYTES) revert InvalidPayload();
        bytes32 payloadHash = keccak256(payload);
        // Idempotent per author/content: uncertain submissions must be checked,
        // not silently resent. A failed duplicate can still consume network gas.
        recordId = keccak256(abi.encode(block.chainid, address(this), msg.sender, payloadHash));
        if (records[recordId].author != address(0)) revert AlreadyRecorded();
        records[recordId] = Record(msg.sender, block.timestamp, payload);
        emit PrayerRecorded(recordId, msg.sender, payloadHash);
    }

    function readPrayer(bytes32 recordId) external view returns (address author, uint256 createdAt, bytes memory payload) {
        Record storage item = records[recordId];
        return (item.author, item.createdAt, item.payload);
    }
}
