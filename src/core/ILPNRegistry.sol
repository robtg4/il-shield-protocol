// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title ILPNRegistry
/// @notice Non-transferable ERC-721 registry for IL Protection NFTs
/// @dev Soulbound — transfers between non-zero addresses are blocked
contract ILPNRegistry is ERC721, AccessControl {
    using Strings for uint256;
    using Strings for int24;

    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");

    error NonTransferable();

    struct ILPNMetadata {
        bytes32 poolId;
        uint8 coverageTier;
        uint48 coverageStartBlock;
        uint48 coverageEndBlock;
        bool settled;
    }

    /// @notice On-chain metadata for each ILPN
    mapping(uint256 => ILPNMetadata) public metadata;

    constructor(address admin) ERC721("IL Protection NFT", "ILPN") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Override _update to make tokens soulbound
    /// @dev Allows minting (from == 0) and burning (to == 0), blocks all transfers
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert NonTransferable();
        }
        return super._update(to, tokenId, auth);
    }

    /// @notice Mint a new ILPN (only callable by ILShieldCore)
    /// @param to The LP receiving the protection NFT
    /// @param tokenId The ILPN token ID
    function mint(address to, uint256 tokenId) external onlyRole(CORE_ROLE) {
        _safeMint(to, tokenId);
    }

    /// @notice Burn an ILPN on settlement or expiry (only callable by ILShieldCore)
    /// @param tokenId The ILPN token ID to burn
    function burn(uint256 tokenId) external onlyRole(CORE_ROLE) {
        _burn(tokenId);
        delete metadata[tokenId];
    }

    /// @notice Set metadata for an ILPN (only callable by ILShieldCore)
    function setMetadata(
        uint256 tokenId,
        bytes32 poolId,
        uint8 coverageTier,
        uint48 coverageStartBlock,
        uint48 coverageEndBlock
    ) external onlyRole(CORE_ROLE) {
        metadata[tokenId] = ILPNMetadata({
            poolId: poolId,
            coverageTier: coverageTier,
            coverageStartBlock: coverageStartBlock,
            coverageEndBlock: coverageEndBlock,
            settled: false
        });
    }

    /// @notice Mark an ILPN as settled
    function markSettled(uint256 tokenId) external onlyRole(CORE_ROLE) {
        metadata[tokenId].settled = true;
    }

    /// @notice On-chain SVG metadata
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        ILPNMetadata memory meta = metadata[tokenId];

        string memory tierStr = meta.coverageTier == 0 ? "50%" : meta.coverageTier == 1 ? "75%" : "100%";
        string memory statusStr = meta.settled ? "Settled" : "Active";
        string memory color = meta.settled ? "#888888" : "#4CAF50";

        string memory svg = string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="200" viewBox="0 0 350 200">',
                '<rect width="350" height="200" rx="12" fill="#1a1a2e"/>',
                '<text x="20" y="35" font-family="monospace" font-size="16" fill="#e0e0e0">IL Shield Protection</text>',
                '<text x="20" y="65" font-family="monospace" font-size="12" fill="#888">ILPN #',
                tokenId.toString(),
                "</text>",
                '<text x="20" y="95" font-family="monospace" font-size="14" fill="',
                color,
                '">Coverage: ',
                tierStr,
                "</text>",
                '<text x="20" y="125" font-family="monospace" font-size="12" fill="#e0e0e0">Start: ',
                uint256(meta.coverageStartBlock).toString(),
                "</text>",
                '<text x="20" y="150" font-family="monospace" font-size="12" fill="#e0e0e0">End: ',
                uint256(meta.coverageEndBlock).toString(),
                "</text>",
                '<text x="20" y="180" font-family="monospace" font-size="14" fill="',
                color,
                '">Status: ',
                statusStr,
                "</text></svg>"
            )
        );

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"ILPN #',
                        tokenId.toString(),
                        '","description":"IL Shield Protection NFT - Non-transferable IL coverage for Uniswap v4 LP position","image":"data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    /// @notice Required override for AccessControl + ERC721
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
