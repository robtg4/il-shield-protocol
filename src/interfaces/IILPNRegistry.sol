// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

interface IILPNRegistry is IERC721 {
    error NonTransferable();

    function mint(address to, uint256 tokenId) external;
    function burn(uint256 tokenId) external;
}
