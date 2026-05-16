// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract AgentBetGame {
    address public immutable admin;

    event HandSettled(
        uint256 indexed handId,
        uint256 indexed tableId,
        address[] winners,
        uint256[] payouts,
        address[] losers,
        uint256 pot
    );

    error NotAdmin();
    error WinnerPayoutLengthMismatch();
    error PotMismatch();

    constructor() {
        admin = msg.sender;
    }

    function recordHand(
        uint256 handId,
        uint256 tableId,
        address[] calldata winners,
        uint256[] calldata payouts,
        address[] calldata losers,
        uint256 pot
    ) external {
        if (msg.sender != admin) revert NotAdmin();
        if (winners.length != payouts.length) revert WinnerPayoutLengthMismatch();

        uint256 total;
        for (uint256 i; i < payouts.length; ++i) {
            total += payouts[i];
        }
        if (total != pot) revert PotMismatch();

        emit HandSettled(handId, tableId, winners, payouts, losers, pot);
    }
}
